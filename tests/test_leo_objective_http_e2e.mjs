import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {handleLeoObjective} from '../lib/leo_objectives_http.js';

test('authenticated Leo HTTP objective persists, executes a guarded read and resumes', async () => {
 const old=process.env.LEO_TENANT_TOKEN_SECRET;
 process.env.LEO_TENANT_TOKEN_SECRET='z'.repeat(48);
 try {
  const payload={aud:'leo-factory-v1',tenantId:'tenant_001',subject:'owner_001',roles:['tenant_admin'],exp:Math.floor(Date.now()/1000)+3600};
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature=crypto.createHmac('sha256',process.env.LEO_TENANT_TOKEN_SECRET).update(body).digest('base64url');
  const authorization='Bearer '+body+'.'+signature;
  const records=new Map();
  const store={
   read:async k=>structuredClone(records.get(k)??null),
   writeIfVersion:async(k,v,r)=>{
    if((records.get(k)?.version??null)!==v)return false;
    records.set(k,structuredClone(r));return true;
   }
  };
  const request=async b=>{
   let code=0,response;
   const res={setHeader(){},status(n){code=n;return this},json(data){response=data;return this}};
   await handleLeoObjective({method:'POST',headers:{authorization},body:b},res,{store});
   assert.equal(code,200,JSON.stringify(response));
   return response.record;
  };
  let r=await request({operation:'create',objective:{id:'goal_001',description:'Inspect an existing customer objective',criteria:'Persist a verified read-only receipt'}});
  r=await request({operation:'transition',input:{id:r.id,expectedVersion:r.version,action:'plan',eventId:'plan_001',plan:['Inspect the objective in isolated storage']}});
  r=await request({operation:'transition',input:{id:r.id,expectedVersion:r.version,action:'approve',eventId:'approve_001',approval:true}});
  r=await request({operation:'transition',input:{id:r.id,expectedVersion:r.version,action:'execute',eventId:'execute_001',approval:true,toolName:'inspect_objective',input:{id:r.id}}});
  assert.equal(r.status,'AWAITING_REVIEW');
  assert.match(r.lastTool.receipt,/leo-inspect:goal_001:v/);
  const resumed=await request({operation:'read',id:r.id});
  assert.equal(resumed.version,r.version);
  r=await request({operation:'transition',input:{id:r.id,expectedVersion:r.version,action:'complete',eventId:'complete_001',approval:true}});
  assert.equal(r.status,'COMPLETED');
 } finally {
  if(old===undefined)delete process.env.LEO_TENANT_TOKEN_SECRET;
  else process.env.LEO_TENANT_TOKEN_SECRET=old;
 }
});

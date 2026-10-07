import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {signInteragent} from '../../lib/interagent_coordinator.js';
const auth=JSON.parse(await readFile('scratch/commercial-scale/n8n-runtime/client-auth.json','utf8'));
const report={at:new Date().toISOString(),scope:'Private support coordination for existing CRM account; no external contact or charge',checks:[],status:'FAIL'};
const request=async(body,{unsigned=false,wrongKey=false}={})=>{
 const signed={...body,signedAt:new Date().toISOString()};
 const r=await fetch('https://boltech-group.vercel.app/api/partners?action=interagent',{method:'POST',headers:{'Content-Type':'application/json',...(!unsigned?{'X-Boltech-Signature':signInteragent(signed,wrongKey?'invalid-signing-key':auth.roleKeys[body.from])}:{})},body:JSON.stringify(signed),signal:AbortSignal.timeout(30000)});
 return {status:r.status,body:await r.json()};
};
const check=(name)=>report.checks.push({name,status:'PASS'});
try{
 const base={opportunityId:'rec0B6iM5STKRlVZY',type:'SUPPORT_REQUEST',problem:'SUPPORT_NEEDED'};
 assert.equal((await request({operation:'queue',from:'DIRECTORA'},{unsigned:true})).status,401);check('unsigned request rejected');
 assert.equal((await request({operation:'queue',from:'RSI-03'},{wrongKey:true})).status,401);check('invalid role signature rejected');
 for(const from of ['RSI-01','RSI-02','RSI-03']){
  const event={eventId:`adk-support-${from}-2026-10-07`,opportunityId:base.opportunityId,from,type:base.type,problem:base.problem};
  const a=await request(event);assert.equal(a.status,200);assert.equal(a.body.success,true);assert.equal(a.body.material.requestedBy,from);assert.equal(a.body.saleCounted,false);check(`${from} support persisted`);
  const replay=await request(event);assert.equal(replay.body.reused,true);check(`${from} replay deduplicated`);
  const inbox=await request({from,operation:'queue'});assert.ok(inbox.body.pending.some(x=>x.eventId===event.eventId));check(`${from} delivery readable`);
 }
 const deny=await request({...base,from:'RSI-01',eventId:'adk-support-RSI-01-2026-10-07',problem:'NO_RESPONSE'});assert.equal(deny.status,409);check('same ID changed content rejected');
 const closure=await request({from:'RSI-03',eventId:'qa-close-denial-adk-20261007',opportunityId:base.opportunityId,type:'CLOSE_REPORTED',orderId:'unverified-order-fixture',acceptanceRef:'qa-reference'});assert.equal(closure.status,409);assert.equal(closure.body.code,'INTERAGENT_PAYMENT_UNVERIFIED');check('unverified payment cannot report commercial closure');
 const director=await request({from:'DIRECTORA',operation:'queue'});assert.equal(director.body.commercialSaleInferred,false);assert.ok(!director.body.pending.some(x=>x.eventId==='qa-close-denial-adk-20261007'));check('rejected closure never enters director queue');
 report.status='PASS';
}catch(e){report.error=String(e.message).slice(0,300);process.exitCode=1;}
await writeFile('scratch/commercial-scale/interagent-cloud-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));

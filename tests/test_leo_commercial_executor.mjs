import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeoExecution} from '../cloudflare/leo-commercial-executor.mjs';
import {handleLeoPublicIntake} from '../cloudflare/leo-public-intake.mjs';
import {handleLeoCommerce} from '../cloudflare/leo-commerce.mjs';
const origin='https://boltech-group.pages.dev';
function setup(){
 const storage=new Map(),env={LEO_PLATFORM_TOKEN:'synthetic-executor-owner-secret-long-enough',COMMERCE:{get:async key=>storage.get(key)||null,put:async(key,val)=>storage.set(key,val)}};
 const seal=async record=>'enc.'+Buffer.from(JSON.stringify(record)).toString('base64url');
 const unseal=async value=>JSON.parse(Buffer.from(value.substring(4),'base64url').toString());
 const deps={seal,unseal,ownerRequest:async request=>request,authorize:request=>request.headers.get('Authorization')==='Bearer owner'};
 const request=(path,data,owner=true)=>new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(owner?{Authorization:'Bearer owner'}:{})},body:JSON.stringify(data)});
 const invoke=async (fn,path,data,owner=true)=>{const response=await fn(request(path,data,owner),env,deps);return {status:response.status,body:await response.json()};};
 return {env,storage,request,invoke};
}
test('real inbound case executes encrypted internal plan; no money, delivery or external dispatch',async()=>{
 const h=setup();
 const intake=await h.invoke(handleLeoPublicIntake,'/api/leo-public-intake',{
  company:'Example Client',contact:'Example Buyer',email:'buyer@example.test',need:'Automate FAQ and customer requests.',website:'',consent:true
 });
 assert.equal(intake.status,201);const id=intake.body.reference;
 const read=async()=>{const response=await handleLeoCommerce(new Request(origin+'/api/leo-commerce?id='+id,{headers:{Authorization:'Bearer owner'}}),h.env,{
  ownerRequest:async request=>request,authorize:request=>request.headers.get('Authorization')==='Bearer owner',
  seal:async v=>'enc.'+Buffer.from(JSON.stringify(v)).toString('base64url'),
  unseal:async v=>JSON.parse(Buffer.from(v.slice(4),'base64url').toString())
 });return (await response.json()).record;};
 let rec=await read();
 const unauth=await h.invoke(handleLeoExecution,'/api/leo-execute',{action:'prepare',id,expectedVersion:rec.version},false);
 assert.equal(unauth.status,401);
 const invalid=await h.invoke(handleLeoExecution,'/api/leo-execute',{action:'prepare',id,expectedVersion:2});
 assert.equal(invalid.status,409);
 const result=await h.invoke(handleLeoExecution,'/api/leo-execute',{action:'prepare',id,expectedVersion:rec.version});
 assert.equal(result.status,200);
 assert.equal(result.body.execution.qualification.status,'INCOMPLETE');
 assert.equal(result.body.execution.proposalDraft.amountCents,null);
 assert.equal(result.body.execution.followupDraft.dispatched,false);
 assert.equal(result.body.execution.afterSales.agentActivated,false);
 assert.equal(result.body.execution.authorizedExternalActions.length,0);
 rec=await read();
 assert.equal(rec.commercialExecution.receiptId,result.body.receiptId);
 assert.equal(rec.paymentVerified,false);assert.equal(rec.externalMessagesSent,0);
 assert.equal(h.storage.get('leo:commercial:v1:'+id).includes('Example Client'),false);
 const replay=await h.invoke(handleLeoExecution,'/api/leo-execute',{action:'prepare',id,expectedVersion:1});
 assert.equal(replay.status,409);
});
test('execution requires owner and same origin, rejects malformed records',async()=>{
 const h=setup();
 const bogus='00000000-0000-4000-8000-000000000000';
 assert.equal((await h.invoke(handleLeoExecution,'/api/leo-execute',{action:'prepare',id:bogus,expectedVersion:1})).status,404);
 assert.equal((await h.invoke(handleLeoExecution,'/api/leo-execute',{action:'dispatch',id:bogus,expectedVersion:1})).status,400);
 const response=await handleLeoExecution(new Request(origin+'/api/leo-execute',{method:'POST',headers:{Origin:'https://outside.invalid',Authorization:'Bearer owner'},body:'{}'}),h.env,{
 ownerRequest:async req=>req,authorize:()=>true});
 assert.equal(response.status,403);
});

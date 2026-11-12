import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/pages-leo-audio-worker.mjs';
const origin='https://boltech-group.pages.dev';
const owner='isolated-owner-token-over-24-characters';
function fixture(){
 const map=new Map(),env={LEO_PLATFORM_TOKEN:owner,COMMERCE:{get:async k=>map.get(k)||null,put:async(k,v)=>map.set(k,v)}};
 async function call(path,data,auth=true){
  const response=await worker.fetch(new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+owner}:{})},body:JSON.stringify(data)}),env);
  return {status:response.status,data:await response.json()};
 }
 return {map,env,call};
}
test('real Pages handlers connect commercial closure to live customer setup invitation without paid/delivered claims',async()=>{
 const h=fixture();
 let create=await h.call('/api/leo-commerce',{action:'create',company:'Testing Buyer',contact:'Buyer',need:'Configure incoming messages'});
 assert.equal(create.status,201);let rec=create.data.record;
 const apply=async(action,details={})=>{
  const res=await h.call('/api/leo-commerce',{action,id:rec.id,expectedVersion:rec.version,...details});
  if(res.status===200)rec=res.data.record;return res;
 };
 assert.equal((await h.call('/api/leo-execute',{action:'prepare_onboarding',id:rec.id,expectedVersion:rec.version,confirmed:true})).status,409);
 assert.equal((await apply('qualify',{budget:'USD 600',timeline:'2 weeks',decisionMaker:'Buyer'})).status,200);
 assert.equal((await apply('proposal',{scope:'FAQ assistant',exclusions:'No payments or Meta delivery',amountCents:60000})).status,200);
 assert.equal((await apply('approve',{confirmed:true})).status,200);
 assert.equal((await apply('close',{outcome:'WON',confirmed:true,customerAccepted:true,evidence:'Owner-provided fictional buyer acceptance'})).status,200);
 const unauthorized=await h.call('/api/leo-execute',{action:'prepare_onboarding',id:rec.id,expectedVersion:rec.version,confirmed:true},false);
 assert.equal(unauthorized.status,401);
 const handed=await h.call('/api/leo-execute',{action:'prepare_onboarding',id:rec.id,expectedVersion:rec.version,confirmed:true});
 assert.equal(handed.status,200);
 assert.equal(handed.data.mode,'CONFIGURATION_INVITATION_PREPARED_NOT_SENT');
 assert.match(handed.data.invitationUrl,/^https:\/\/boltech-group\.pages\.dev\/customer-setup#access=/);
 assert.equal(handed.data.afterSales.agentActivated,false);
 assert.equal(handed.data.afterSales.paymentVerified,false);
 assert.equal(handed.data.afterSales.externalInvitationSent,false);
 const access=new URLSearchParams(new URL(handed.data.invitationUrl).hash.slice(1)).get('access');
 assert.ok(access);
 const response=await worker.fetch(new Request(origin+'/api/customer-setup?action=read',{headers:{'X-Setup-Access':access}}),h.env);
 assert.equal(response.status,200);
 const info=await response.json();
 assert.equal(info.orderId,handed.data.afterSales.orderId);
 assert.equal(info.mode,'CUSTOMER');assert.equal(info.agentActivated,false);
 const oldVersion=await h.call('/api/leo-execute',{action:'prepare_onboarding',id:rec.id,expectedVersion:rec.version,confirmed:true});
 assert.equal(oldVersion.status,409);
 assert.equal(h.map.size>=2,true);
});
test('actual public intake route triggers commercial executor and persists its result in owner-only record',async()=>{
 const h=fixture();
 const submitted=await h.call('/api/leo-public-intake',{
  company:'Customer Example',contact:'Visitor',email:'visitor@example.test',need:'Support frequently asked product questions',consent:true,website:''
 },false);
 assert.equal(submitted.status,201);
 const saved=await worker.fetch(new Request(origin+'/api/leo-commerce?id='+submitted.data.reference,{headers:{Authorization:'Bearer '+owner}}),h.env);
 assert.equal(saved.status,200);
 const record=(await saved.json()).record;
 assert.equal(record.commercialExecution.engine,'LEO_COMMERCIAL_EXECUTOR_V1');
 assert.equal(record.commercialExecution.persisted,true);
 assert.equal(record.commercialExecution.proposalDraft.amountCents,null);
 assert.equal(record.externalMessagesSent,0);
});

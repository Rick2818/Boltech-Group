import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {signInteragent} from '../../lib/interagent_coordinator.js';
const auth=JSON.parse(await readFile('scratch/commercial-scale/n8n-runtime/client-auth.json','utf8'));
const endpoint='http://127.0.0.1:5678/webhook/boltech-sales-marketing';
const report={at:new Date().toISOString(),scope:'LOCAL_N8N_CLOUD_COORDINATION_NO_CUSTOMER_MESSAGES_OR_REVENUE',checks:[],status:'FAIL'};
async function request(event,authorized=true,wrongKey=false){const signed={...event,signedAt:new Date().toISOString()};const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{'X-Boltech-Agent-Key':auth.key,'X-Boltech-Signature':signInteragent(signed,wrongKey?'invalid-signing-key':auth.roleKeys[event.from]||'invalid-role')}:{})},body:JSON.stringify(signed),signal:AbortSignal.timeout(30000)});let data;try{data=await r.json();}catch{data={code:'NON_JSON_RESPONSE'};}return {status:r.status,data};}
try{
 const base={eventId:'adk-support-RSI-01-2026-10-07',opportunityId:'rec0B6iM5STKRlVZY',from:'RSI-01',type:'SUPPORT_REQUEST',problem:'SUPPORT_NEEDED'};
 const denied=await request(base,false);assert.equal(denied.status,403);report.checks.push('unauthorized rejected');
 for(const from of ['RSI-01','RSI-02','RSI-03']){
  const result=await request({...base,eventId:`adk-support-${from}-2026-10-07`,from});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.material.owner,'marketing-director');assert.equal(result.data.deliveredTo,from);assert.equal(result.data.usedBySales,false);assert.equal(result.data.material.saleVerified,false);assert.equal(result.data.reused,true);report.checks.push(`${from} receives existing bilingual material without duplicate task`);
 }
 const alt=await request({...base,eventId:'qa-n8n-unverified-retry-20261007',attempt:1});assert.equal(alt.data.success,false);assert.equal(alt.data.code,'INTERAGENT_PREVIOUS_RESULT_REQUIRED');report.checks.push('caller cannot reset server attempt or skip recorded result');
 const badSignature=await request(base,true,true);assert.equal(badSignature.data.success,false);assert.equal(badSignature.data.code,'INTERAGENT_AUTH_REQUIRED');report.checks.push('per-role signature checked by server');
 const invalid=await request({...base,from:'EXTERNAL'});assert.equal(invalid.status,400);assert.equal(invalid.data.success,false);report.checks.push('invalid identity rejected');
 const close=await request({eventId:'qa-n8n-close-denial-20261007',opportunityId:base.opportunityId,from:'RSI-03',type:'CLOSE_REPORTED',orderId:'unverified-order-fixture',acceptanceRef:'qa-reference'});assert.equal(close.data.success,false);assert.equal(close.data.code,'INTERAGENT_PAYMENT_UNVERIFIED');report.checks.push('unverified closure rejected before director notification');
 report.status='PASS';
}catch(error){report.error=String(error.message).slice(0,400);process.exitCode=1;}
await writeFile('scratch/commercial-scale/n8n-communication-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));

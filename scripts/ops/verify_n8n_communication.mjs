import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const auth=JSON.parse(await readFile('scratch/commercial-scale/n8n-runtime/client-auth.json','utf8'));
const endpoint='http://127.0.0.1:5678/webhook/boltech-sales-marketing';
const report={at:new Date().toISOString(),scope:'LOCAL_N8N_QA_NO_CUSTOMER_MESSAGES_OR_REVENUE',checks:[],status:'FAIL'};
async function request(event,authorized=true){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{'X-Boltech-Agent-Key':auth.key}:{})},body:JSON.stringify(event),signal:AbortSignal.timeout(30000)});let data;try{data=await r.json();}catch{data={code:'NON_JSON_RESPONSE'};}return {status:r.status,data};}
try{
 const base={eventId:`qa-n8n-${Date.now()}`,opportunityId:'qa-only-no-customer',from:'RSI-01',type:'PROBLEM',problem:'NO_RESPONSE'};
 const denied=await request(base,false);assert.equal(denied.status,403);report.checks.push('unauthorized rejected');
 for(const from of ['RSI-01','RSI-02','RSI-03']){
  const result=await request({...base,eventId:`${base.eventId}-${from}`,from});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.material.owner,'marketing-director');assert.equal(result.data.deliveredTo,from);assert.equal(result.data.usedBySales,false);assert.equal(result.data.material.saleVerified,false);report.checks.push(`${from} receives bilingual material`);
 }
 const alt=await request({...base,eventId:`base-${Date.now()}`,attempt:1});assert.equal(alt.data.action,'REFRAME_ONE_SPECIFIC_PROBLEM');report.checks.push('alternative selected');
 const unknown=await request({...base,problem:'SEND_UNKNOWN'});assert.equal(unknown.data.action,'RECONCILE_PROVIDER_RECEIPT_WITHOUT_RESENDING');report.checks.push('uncertain send never resent');
 const invalid=await request({...base,from:'EXTERNAL'});assert.equal(invalid.status,400);report.checks.push('invalid identity rejected');
 const close=await request({...base,from:'RSI-03',type:'CLOSE_REPORTED',evidenceRef:'qa-receipt-not-a-sale'});assert.deepEqual(close.data.notificationChain,['RSI-03','DIRECTORA','RICARDO']);assert.equal(close.data.paymentVerified,false);assert.equal(close.data.ricardoNotified,false);report.checks.push('RSI03 closure delivered to director review, revenue not inferred');
 report.status='PASS';
}catch(error){report.error=String(error.message).slice(0,400);process.exitCode=1;}
await writeFile('scratch/commercial-scale/n8n-communication-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));

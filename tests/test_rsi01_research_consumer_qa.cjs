const test=require('node:test');
const assert=require('node:assert/strict');
const qa=require('../config/qa_case.json');
const {consume}=require('../scripts/rsi01-research-work-consumer.cjs');
const row={id:qa.id,fields:{'Work ID':'LEAD_INTAKE:'+qa.id,'Source Record ID':qa.id,Owner:'RSI-02',Status:'WAITING_RESPONSE'}};
test('consumer paginates current work, preserves assignment and excludes the sole QA',async()=>{
 let calls=0;
 const result=await consume({token:'qa',base:'qa',fetchImpl:async(url,options)=>{
  assert.equal(options.method,undefined);calls++;
  return {ok:true,json:async()=>calls===1?{records:[],offset:qa.id}:{records:[row]}};
 }});
 assert.equal(calls,2);assert.equal(result.receipts[0].owner,'RSI-02');
 assert.equal(result.receipts[0].status,'WAITING_RESPONSE');assert.equal(result.receipts[0].result,'QA_EXCLUDED');
 assert.equal(result.receipts[0].nextAction,null);assert.equal(result.receipts[0].sendAllowed,false);
});
test('consumer refuses duplicate task identities without writes',async()=>{
 await assert.rejects(consume({token:'qa',base:'qa',fetchImpl:async()=>({ok:true,json:async()=>({records:[row,row]})})}),/DUPLICATE_WORK_ID/);
});
test('consumer does not accept incomplete pagination',async()=>{
 await assert.rejects(consume({token:'qa',base:'qa',fetchImpl:async()=>({ok:true,json:async()=>({records:[],offset:qa.id})})}),/REPEATED_CURSOR/);
});

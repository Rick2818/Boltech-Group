const test=require('node:test');
const assert=require('node:assert/strict');
const qa=require('../config/qa_case.json');
const {intake}=require('../scripts/rsi01-airtable-intake.cjs');
const event={event_id:qa.requestId,producer:'BLIA-01',event_type:'LEAD_RESEARCHED',synthetic:false,lead_id:qa.id,evidence_ref:'https://example.com/'+qa.id,payload:{title:qa.answers[7],market:'US',status:'RESEARCH_REQUIRED',buyer_verified:false,contact_verified:false}};
test('requires authenticated intake',async()=>await assert.rejects(intake({consumer:'RSI-01',events:[event]}),/AUTH_NOT_CONFIGURED/));
test('deduplicates and rereads existing sole QA transport fixture',async()=>{
 let calls=0;const row={id:qa.id,fields:{'Work ID':'BLIA01:'+qa.requestId,'Source Record ID':qa.id}};
 const r=await intake({consumer:'RSI-01',events:[event]},{token:'qa',base:'qa',fetchImpl:async url=>{calls++;return {ok:true,json:async()=>url.includes('?')?{records:[row]}:row};}});
 assert.equal(calls,2);assert.equal(r.receipts[0].state,'EXISTS');assert.equal(r.receipts[0].readback_verified,true);
});
test('creates blocked research work with confirmed mock readback',async()=>{
 let post;const row={id:qa.id,fields:{'Work ID':'BLIA01:'+qa.requestId,'Source Record ID':qa.id}};
 const fetchImpl=async(url,o)=>{if(o.method==='POST'){post=JSON.parse(o.body);return {ok:true,json:async()=>({records:[row]})};}return {ok:true,json:async()=>url.includes('?')?{records:[]}:row};};
 const r=await intake({consumer:'RSI-01',events:[event]},{token:'qa',base:'qa',fetchImpl});
 assert.equal(r.receipts[0].state,'CREATED');assert.equal(post.records[0].fields['Execution State'],'BLOCKED');assert.match(post.records[0].fields.Authorization,/NO SEND/);
});

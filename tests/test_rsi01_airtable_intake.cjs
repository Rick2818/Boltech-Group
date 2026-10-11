const test=require('node:test');
const assert=require('node:assert/strict');
const {intake}=require('../scripts/rsi01-airtable-intake.cjs');
const event={event_id:'a'.repeat(64),producer:'BLIA-01',event_type:'LEAD_RESEARCHED',synthetic:false,lead_id:'research:abc',evidence_ref:'https://example.org/rfp',payload:{title:'RFP',market:'US',status:'RESEARCH_REQUIRED',buyer_verified:false,contact_verified:false}};
test('requires authenticated intake',async()=>await assert.rejects(intake({consumer:'RSI-01',events:[event]}),/AUTH_NOT_CONFIGURED/));
test('deduplicates existing work',async()=>{let calls=0;const f=async()=>{calls++;return {ok:true,json:async()=>({records:[{id:'recExisting'}]})}};const r=await intake({consumer:'RSI-01',events:[event]},{token:'test',base:'appTest',fetchImpl:f});assert.equal(calls,1);assert.equal(r.receipts[0].state,'EXISTS')});
test('creates blocked research work, not send authorization',async()=>{let post;const f=async(_u,o)=>o.method==='POST'?(post=JSON.parse(o.body),{ok:true,json:async()=>({records:[{id:'recNew'}]})}):{ok:true,json:async()=>({records:[]})};const r=await intake({consumer:'RSI-01',events:[event]},{token:'test',base:'appTest',fetchImpl:f});assert.equal(r.receipts[0].state,'CREATED');assert.equal(post.records[0].fields['Execution State'],'BLOCKED');assert.match(post.records[0].fields.Authorization,/NO SEND/)});

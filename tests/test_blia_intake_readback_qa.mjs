import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import qa from '../config/qa_case.json' with {type:'json'};
const {intake}=createRequire(import.meta.url)('../scripts/rsi01-airtable-intake.cjs');
const event={producer:'BLIA-01',event_type:'LEAD_RESEARCHED',synthetic:false,event_id:qa.requestId,lead_id:qa.id,evidence_ref:'https://example.com/'+qa.id,payload:{status:'RESEARCH_REQUIRED',buyer_verified:false,contact_verified:false,title:qa.answers[7]}};
// Transport-only variations of the sole QA; no network, customer or commercial work created.
test('BLIA receipt requires readback and preserves current owner and stage',async()=>{
 const row={id:'recQA202610100000',fields:{'Work ID':'BLIA01:'+qa.requestId,'Source Record ID':qa.id,Owner:'RSI-02',Status:'WAITING_RESPONSE'}};
 let writes=0;
 const receipt=await intake({consumer:'RSI-01',events:[event]},{token:'qa',base:'qa',fetchImpl:async(url,options)=>{if(options.method){writes++;throw Error('No write allowed');}return {ok:true,json:async()=>url.includes('?')?{records:[row]}:row};}});
 assert.equal(writes,0);assert.equal(receipt.receipts[0].owner,'RSI-02');assert.equal(receipt.receipts[0].readback_verified,true);
});
test('BLIA ambiguous tasks fail without a mutation',async()=>{
 await assert.rejects(intake({consumer:'RSI-01',events:[event]},{token:'qa',base:'qa',fetchImpl:async()=>({ok:true,json:async()=>({records:[{id:qa.id},{id:qa.id}]})})}),/DUPLICATE_WORK_ID/);
});
test('BLIA creation is not acknowledged when readback disagrees',async()=>{
 let posts=0;
 const fetchImpl=async(url,options)=>{
  if(options.method==='POST'){posts++;return {ok:true,json:async()=>({records:[{id:'recQA202610100000'}]})};}
  return {ok:true,json:async()=>url.includes('?')?{records:[]}:{id:'recQA202610100000',fields:{'Work ID':'BLIA01:'+qa.requestId,'Source Record ID':qa.id+'-invalid'}}};
 };
 await assert.rejects(intake({consumer:'RSI-01',events:[event]},{token:'qa',base:'qa',fetchImpl}),/READBACK_MISMATCH/);
 assert.equal(posts,1);
});

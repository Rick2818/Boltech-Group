const qa=require('../config/qa_case.json');
const test=require('node:test');
const assert=require('node:assert/strict');
const {dispatch,validate}=require('../scripts/rsi01-gmail-dispatch.cjs');
const intent={event_id:qa.requestId,status:'APPROVED_PENDING_DISPATCH',send_performed:false,sender:qa.answers[8],recipient:qa.answers[8],subject:qa.answers[7],body:qa.answers[6],source:'https://example.com/'+qa.id};
const approval={buyer_verified:true,contact_verified:true,intent_verified:true,permission_verified:true,template_approved:true,recipient_verified:true,release_to_send:true,recipient:qa.answers[8],approved_subject:intent.subject,approved_body:intent.body};
test('disabled by default',async()=>assert.deepEqual(await dispatch({results:[intent]}, {},{enabled:undefined}),{state:'DISABLED',sent:0}));
test('sole QA cannot be released even with all approvals',()=>assert.throws(()=>validate(intent,approval,qa.answers[8]),/QA_EXTERNAL_CONTACT_FORBIDDEN/));
test('sole QA cannot reach either ledger or Gmail transport',async()=>{
 let calls=0;
 await assert.rejects(dispatch({executor:'RSI-01',mode:'PREPARE_ONLY',results:[intent]},{[qa.requestId]:approval},{enabled:'true',airtableToken:'qa',airtableBase:'qa',gmailAccessToken:'qa',sender:qa.answers[8]},{fetchImpl:async()=>{calls++;throw Error('Transport forbidden');}}),/QA_EXTERNAL_CONTACT_FORBIDDEN/);
 assert.equal(calls,0);
});

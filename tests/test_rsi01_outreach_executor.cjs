const qa=require('../config/qa_case.json');
const test=require('node:test');
const assert=require('node:assert/strict');
const {plan}=require('../scripts/rsi01-outreach-executor.cjs');
const event={event_id:qa.requestId,producer:'BLIA-01',event_type:'LEAD_RESEARCHED',synthetic:false,evidence_ref:'https://example.com/'+qa.id,lead_id:qa.id};
const handoff={consumer:'RSI-01',events:[event]};
test('unknown buyer blocks sending',()=>{const p=plan(handoff);assert.equal(p.results[0].status,'BLOCKED_RESEARCH');assert.equal(p.results[0].send_performed,false);assert.equal(p.results[0].recipient,null)});
test('approved intent remains pending dispatch, never sent',()=>{const a={buyer_verified:true,contact_verified:true,intent_verified:true,permission_verified:true,template_approved:true,recipient_verified:true,recipient:qa.answers[8],sender:qa.answers[8],approved_subject:'Introduction',approved_body:'Hello'};const p=plan(handoff,{[event.event_id]:a});assert.equal(p.results[0].status,'APPROVED_PENDING_DISPATCH');assert.equal(p.results[0].send_performed,false)});
test('rejects synthetic research events',()=>assert.throws(()=>plan({...handoff,events:[{...event,synthetic:true}]}),/Invalid/));

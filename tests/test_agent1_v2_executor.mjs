import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgent1V2} from '../lib/agent1_v2_executor.js';
test('executor rejects missing production adapters',()=>assert.throws(()=>createAgent1V2({}),/DEPENDENCY_MISSING/));
test('reply handling records CRM event without sending',async()=>{
 const events=[];
 const agent=createAgent1V2({redisCommand:async()=>null,mailSender:{send:async()=>{throw Error('NEVER_SEND');}},crm:{recordEvent:async e=>events.push(e)}});
 const reply=await agent.processReply({contactId:'synthetic-1',reply:'Please send pricing'});
 assert.equal(reply.classification.action,'PREPARE_SCOPE_QUESTIONS');
 assert.equal(reply.sent,false);
 assert.equal(events[0].type,'INBOUND_CLASSIFIED');
});
test('quotation requires scope and respects commercial price',async()=>{
 const events=[];
 const agent=createAgent1V2({redisCommand:async()=>null,mailSender:{send:async()=>{}},crm:{recordEvent:async e=>events.push(e)}});
 const quote=await agent.prepareQuote({contactId:'synthetic-1',scopeAccepted:true,discountPercent:10,approvedQuote:{ownerApproved:true,approvalId:'QA-APPROVAL',amount:990,currency:'USD',maxDiscountPercent:10,upfrontPercent:50}});
 assert.equal(quote.total,891);
 assert.equal(quote.upfront,445.5);
 assert.equal(quote.readyToOffer,true);
 assert.equal(quote.sent,false);
 assert.equal(events[0].type,'QUOTE_PREPARED');
});

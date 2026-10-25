import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySalesReply,quotePilot,nextSalesAction} from '../lib/agent1_v2_sales_cycle.js';
test('opt-out and bounce suppress all followup',()=>{
 assert.equal(classifySalesReply({text:'Please unsubscribe'}).action,'SUPPRESS');
 assert.equal(classifySalesReply({bounced:true}).action,'SUPPRESS');
});
test('negative answer stops sequence',()=>assert.equal(classifySalesReply({text:'Not interested'}).action,'STOP_SEQUENCE'));
test('pricing response requests qualification, not automatic payment',()=>{
 assert.equal(nextSalesAction({reply:'Please send pricing'}).action,'PREPARE_SCOPE_QUESTIONS');
});
test('pilot respects discount, 50/50 and explicit scope acceptance',()=>{
 assert.deepEqual([quotePilot({discountPercent:10,approvedQuote:{ownerApproved:true,approvalId:'QA-APPROVAL',amount:990,currency:'USD',maxDiscountPercent:10,upfrontPercent:50}}).total,quotePilot({discountPercent:10,approvedQuote:{ownerApproved:true,approvalId:'QA-APPROVAL',amount:990,currency:'USD',maxDiscountPercent:10,upfrontPercent:50}}).upfront],[891,445.5]);
 assert.equal(quotePilot().readyToOffer,false);
 assert.equal(quotePilot({scopeAccepted:true}).paymentRequested,false);
 assert.throws(()=>quotePilot({discountPercent:11,approvedQuote:{ownerApproved:true,approvalId:'QA',amount:990,currency:'USD',maxDiscountPercent:10,upfrontPercent:50}}),/DISCOUNT_NOT_AUTHORIZED/);
});
test('closed or blocked deals never send',()=>assert.equal(nextSalesAction({stage:'WON',reply:'price'}).action,'NONE'));

test('no historical price or payment terms are authorized by default',()=>{
 for(const approvedQuote of [null,{amount:990,currency:'USD'},{ownerApproved:true,approvalId:'QA',amount:990,currency:'USD',maxDiscountPercent:10}]){
  const q=quotePilot({scopeAccepted:true,approvedQuote});
  assert.equal(q.total,null);assert.equal(q.readyToOffer,false);assert.equal(q.paymentRequested,false);
 }
});
test('interest requests written scope questions instead of offering a meeting',()=>{
 assert.equal(nextSalesAction({reply:'Yes, interested in a meeting'}).action,'PREPARE_SCOPE_QUESTIONS');
});

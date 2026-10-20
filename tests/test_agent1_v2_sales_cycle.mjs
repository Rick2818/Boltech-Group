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
 assert.deepEqual([quotePilot({discountPercent:10}).total,quotePilot({discountPercent:10}).upfront],[891,445.5]);
 assert.equal(quotePilot().readyToOffer,false);
 assert.equal(quotePilot({scopeAccepted:true}).paymentRequested,false);
 assert.throws(()=>quotePilot({discountPercent:11}),/DISCOUNT_NOT_AUTHORIZED/);
});
test('closed or blocked deals never send',()=>assert.equal(nextSalesAction({stage:'WON',reply:'price'}).action,'NONE'));

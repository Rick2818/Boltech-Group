import test from 'node:test';
import assert from 'node:assert/strict';
import { rehearseDelivery } from '../lib/client_delivery_rehearsal.js';
test('E1 E2 E3 pass with a synthetic-only evidence receipt',async()=>{
 const x=await rehearseDelivery({orderId:'SYN-KATIA-001'});
 assert.equal(x.status,'PASS');assert.equal(x.kind,'SYNTHETIC_ONLY');assert.equal(x.customerAccepted,false);assert.equal(x.customerDelivered,false);
 assert.deepEqual(x.events.map(e=>e.role),['E1_IMPLEMENTATION','E2_QA','E3_CERTIFICATION']);
 assert.match(x.digest,/^[0-9a-f]{64}$/);
});
test('E4 recovers a transient simulated QA failure and captures both attempts',async()=>{
 const x=await rehearseDelivery({orderId:'SYN-KATIA-001',failFirst:true});
 assert.equal(x.attempts,2);
 assert.deepEqual(x.events.map(e=>e.role),['E1_IMPLEMENTATION','E2_QA','E4_RSI','E2_QA','E3_CERTIFICATION']);
 assert.equal(x.events[1].status,'BLOCKED');
});
test('Real order IDs cannot pass synthetic rehearsal',async()=>{
 await assert.rejects(()=>rehearseDelivery({orderId:'KATIA-REAL-001'}),/SYNTHETIC_ONLY/);
});

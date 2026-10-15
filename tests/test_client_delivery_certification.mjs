import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDelivery } from '../lib/client_delivery_certification.js';
const response=async()=>({ok:true,status:200});
test('Synthetic rehearsal verifies infrastructure but never claims customer delivery',async()=>{
 const r=await checkDelivery({orderId:'SYN-001',mode:'synthetic',url:'https://boltech-group.vercel.app',fetcher:response});
 assert.equal(r.status,'INFRA_PASS');assert.equal(r.certificationScope,'INFRASTRUCTURE_ONLY');assert.equal(r.checks.customerEvidence,false);
});
test('Customer orders cannot be certified without delivery and acceptance evidence',async()=>{
 const r=await checkDelivery({orderId:'KATIA-001',mode:'customer',url:'https://boltech-group.vercel.app',fetcher:response});
 assert.equal(r.status,'FAIL');assert.ok(r.blockers.includes('CUSTOMER_ACCEPTANCE_AND_DELIVERY_RECEIPTS_REQUIRED'));
});
test('Failed deployment fails closed',async()=>{
 const r=await checkDelivery({orderId:'SYN-001',mode:'synthetic',url:'https://boltech-group.vercel.app',fetcher:async()=>({ok:false,status:503})});
 assert.equal(r.status,'FAIL');assert.ok(r.blockers.includes('VERCEL_HTTP_503'));
});
test('Disallow off-domain probes and malformed order ids',async()=>{
 const r=await checkDelivery({orderId:'?',mode:'synthetic',url:'https://example.com',fetcher:response});
 assert.equal(r.status,'FAIL');assert.equal(r.checks.productionReachable,false);
});

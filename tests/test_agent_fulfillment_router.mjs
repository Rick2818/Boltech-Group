import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentFulfillmentRouter} from '../lib/agent_fulfillment_router.js';
function fixture(kind='prebuilt'){
 let custom=0,prebuilt=0;
 const order={orderId:'order-a',customerId:'customer-a',version:2,delivery:'NOT_DELIVERED',
   execution:'READY_FOR_BUILD_AND_QA',productId:'product-a',fingerprint:'fingerprint-a',plan:{commit:'a'.repeat(40)}};
 const product={productId:'product-a',version:'catalog-v1',approved:true,kind,
   templateId:'support',templateVersion:'template-v2',certificationRef:'cert-verified'};
 const deps={
 ledger:{read:async()=>order},catalog:{resolve:async()=>product},
 customFactory:{prepare:async()=>{custom++;return {orderId:'order-a',status:'READY_FOR_DELIVERY_REVIEW',customerDelivery:false,evidence:{qa:'qa-reference'}}}},
 activation:{activate:async()=>{prebuilt++;return {orderId:'order-a',customerId:'customer-a',tenantId:'tenant-a',
 templateId:'support',templateVersion:'template-v2',isolated:true,accessible:true,evidenceRef:'activation-reference'}}}
 };
 return {order,product,deps,counts:()=>({custom,prebuilt}),router:createAgentFulfillmentRouter(deps)};
}
const req={orderId:'order-a',customerId:'customer-a',expectedVersion:2};
test('prebuilt orders activate a certified template without custom construction',async()=>{
 const f=fixture(),r=await f.router.prepare(req);
 assert.equal(r.fulfillmentKind,'prebuilt');assert.equal(r.customerDelivery,false);
 assert.deepEqual(f.counts(),{custom:0,prebuilt:1});
});
test('custom orders invoke fabrication and independent QA without template activation',async()=>{
 const f=fixture('custom'),r=await f.router.prepare(req);
 assert.equal(r.fulfillmentKind,'custom');assert.equal(r.customerDelivery,false);
 assert.deepEqual(f.counts(),{custom:1,prebuilt:0});
});
test('client cannot force route, other identity or stale version',async()=>{
 const f=fixture();
 await assert.rejects(f.router.prepare({...req,customerId:'other',kind:'custom'}),/ORDER_NOT_APPROVED/);
 await assert.rejects(f.router.prepare({...req,expectedVersion:1}),/ORDER_NOT_APPROVED/);
 assert.deepEqual(f.counts(),{custom:0,prebuilt:0});
});
test('uncertified template and unapproved catalog fail closed',async()=>{
 const f=fixture();f.product.certificationRef=null;
 await assert.rejects(f.router.prepare(req),/TEMPLATE_UNCERTIFIED/);
 f.product.certificationRef='cert';f.product.approved=false;
 await assert.rejects(f.router.prepare(req),/CATALOG_UNAPPROVED/);
 assert.deepEqual(f.counts(),{custom:0,prebuilt:0});
});
test('prebuilt cross-tenant and access failure cannot be reported as ready',async()=>{
 const f=fixture();f.deps.activation.activate=async()=>({orderId:'order-a',customerId:'customer-b',tenantId:'tenant-b',
 templateId:'support',templateVersion:'template-v2',isolated:false,accessible:false,evidenceRef:'false'});
 await assert.rejects(f.router.prepare(req),/ACTIVATION_UNVERIFIED/);
});

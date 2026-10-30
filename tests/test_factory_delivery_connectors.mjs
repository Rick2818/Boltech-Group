import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createFactoryDeliveryConnectors } from '../lib/factory_delivery_connectors.js';
const digest = createHash('sha256').update('synthetic-agent-artifact').digest('hex');
function setup(changes = {}) {
  const order={orderId:'order-1', customerId:'customer-a', version:3, fingerprint:'fp-1',
    execution:'READY_FOR_BUILD_AND_QA',delivery:'NOT_DELIVERED',
    plan:{commit:'a'.repeat(40),tests:['tests/agent.mjs']}};
  let calls=0;const tenants={
    async provision({orderId,customerId}){calls++;return {orderId,customerId,tenantId:'tenant-a',evidenceRef:'prov-1'}},
    async verifyIsolation(){return {isolated:true,evidenceRef:'isolation-1'}}};
  const builder={async build({orderId,tenantId}){return {orderId,tenantId,eventId:'build-1',buildId:'build-a',templateVersion:'v1',artifactDigest:digest,evidenceRef:'build-1'}}};
  const qa={async verify(){return {passed:true,evidenceRef:'qa-1'}}};
  const access={async verify(){return {accessible:true,evidenceRef:'access-1'}}};
  const ledger={async read(){return order}};
  const connectors=createFactoryDeliveryConnectors({ledger,builder,tenants,qa,access,...changes});
  return {connectors,order,tenants,builder,qa,access,getCalls:()=>calls};
}
const request={orderId:'order-1',customerId:'customer-a',expectedVersion:3};
test('prepares evidence for an approved synthetic order without claiming delivery',async()=>{
  const x=setup();
  const r=await x.connectors.prepare(request);
  assert.equal(r.customerDelivery,false);
  assert.equal(r.status,'READY_FOR_DELIVERY_REVIEW');
  assert.equal(r.tenantId,'tenant-a');
  assert.equal(r.artifactDigest,digest);
  assert.deepEqual(Object.keys(r.evidence),['provision','isolation','build','qa','access']);
});
test('refuses incorrect customer and version before provisioning',async()=>{
  const x=setup();
  await assert.rejects(x.connectors.prepare({...request,customerId:'customer-b'}),{code:'FACTORY_ORDER_NOT_APPROVED'});
  await assert.rejects(x.connectors.prepare({...request,expectedVersion:2}),{code:'FACTORY_ORDER_NOT_APPROVED'});
  assert.equal(x.getCalls(),0);
});
test('rejects non-isolated tenant and cross-tenant builder receipt',async()=>{
  const x=setup({tenants:{async provision(){return {orderId:'order-1',customerId:'customer-a',tenantId:'tenant-a',evidenceRef:'yes'}},
    async verifyIsolation(){return {isolated:false,evidenceRef:'no'}}}});
  await assert.rejects(x.connectors.prepare(request),{code:'FACTORY_TENANT_NOT_ISOLATED'});
  const y=setup({builder:{async build(){return {orderId:'order-1',tenantId:'tenant-b',eventId:'b',buildId:'b',templateVersion:'v1',artifactDigest:digest,evidenceRef:'yes'}}}});
  await assert.rejects(y.connectors.prepare(request),{code:'FACTORY_BUILD_TENANT_MISMATCH'});
});
test('blocks missing QA, access or incomplete build evidence',async()=>{
  await assert.rejects(setup({qa:{async verify(){return {passed:false,evidenceRef:'failed'}}}}).connectors.prepare(request),{code:'FACTORY_QA_UNVERIFIED'});
  await assert.rejects(setup({access:{async verify(){return {accessible:false,evidenceRef:'no'}}}}).connectors.prepare(request),{code:'FACTORY_ACCESS_UNVERIFIED'});
  await assert.rejects(setup({builder:{async build(){return {orderId:'order-1',tenantId:'tenant-a',eventId:'e',buildId:'b',templateVersion:'v1',artifactDigest:'bad',evidenceRef:'yes'}}}}).connectors.prepare(request),{code:'FACTORY_BUILD_RECEIPT_INVALID'});
});
test('requires actual provider implementations',()=>{
  assert.throws(()=>createFactoryDeliveryConnectors({}),{code:'FACTORY_CONNECTOR_NOT_CONFIGURED'});
});

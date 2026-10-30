// Optional external integrations for the factory order PR. No network or tenant mutation
// occurs unless the caller explicitly injects authorized provider implementations.
import { createHash } from 'node:crypto';
const fail = code => { throw Object.assign(new Error(code), { code }); };
const ident = x => typeof x === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(x);
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const provider = (p, methods) => p && methods.every(k => typeof p[k] === 'function');
const receipt = (r, orderId, kind) => {
  if (!r || r.orderId !== orderId || !ident(r.eventId) || !ident(r.tenantId) ||
      !ident(r.buildId) || !/^[a-f0-9]{64}$/.test(r.artifactDigest || '') ||
      !r.evidenceRef || !ident(r.templateVersion)) fail('FACTORY_' + kind + '_RECEIPT_INVALID');
  return r;
};
/**
 * Injected service contracts:
 * builder.build({orderId,version,fingerprint,plan,tenantId,idempotencyKey})
 *   -> {orderId,eventId,tenantId,buildId,templateVersion,artifactDigest,evidenceRef}
 * tenants.provision({orderId,customerId,idempotencyKey})
 *   -> {orderId,tenantId,customerId,evidenceRef}
 * tenants.verifyIsolation({tenantId,customerId}) -> {isolated:true, evidenceRef}
 * qa.verify({orderId,tenantId,buildId,artifactDigest,plan}) -> {passed:true, evidenceRef}
 * access.verify({orderId,tenantId,customerId,buildId}) -> {accessible:true,evidenceRef}
 * No tenant IDs are trusted from a browser: the authorized provider must derive them.
 */
export function createFactoryDeliveryConnectors({ ledger, builder, tenants, qa, access } = {}) {
  if (!provider(ledger, ['read']) || !provider(builder, ['build']) ||
      !provider(tenants, ['provision','verifyIsolation']) ||
      !provider(qa, ['verify']) || !provider(access, ['verify']))
    fail('FACTORY_CONNECTOR_NOT_CONFIGURED');
  async function prepare({ orderId, customerId, expectedVersion }) {
    if (!ident(orderId) || !ident(customerId) || !Number.isSafeInteger(expectedVersion))
      fail('FACTORY_INPUT_INVALID');
    const order = await ledger.read(orderId);
    if (!order || order.version !== expectedVersion || order.delivery !== 'NOT_DELIVERED' ||
        order.execution !== 'READY_FOR_BUILD_AND_QA' || !order.plan ||
        !order.fingerprint || order.customerId !== customerId)
      fail('FACTORY_ORDER_NOT_APPROVED');
    const idempotencyKey = hash({ orderId, version:order.version, fingerprint:order.fingerprint, commit:order.plan.commit });
    const tenant = await tenants.provision({orderId,customerId,idempotencyKey});
    if (!tenant || tenant.orderId !== orderId || tenant.customerId !== customerId ||
        !ident(tenant.tenantId) || !tenant.evidenceRef) fail('FACTORY_TENANT_UNVERIFIED');
    const isolate = await tenants.verifyIsolation({tenantId:tenant.tenantId,customerId});
    if (isolate?.isolated !== true || !isolate.evidenceRef) fail('FACTORY_TENANT_NOT_ISOLATED');
    const built = receipt(await builder.build({orderId,version:order.version,fingerprint:order.fingerprint,
      plan:order.plan,tenantId:tenant.tenantId,idempotencyKey}),orderId,'BUILD');
    if (built.tenantId !== tenant.tenantId) fail('FACTORY_BUILD_TENANT_MISMATCH');
    const passed = await qa.verify({orderId,tenantId:tenant.tenantId,buildId:built.buildId,
      artifactDigest:built.artifactDigest,plan:order.plan});
    if (passed?.passed !== true || !passed.evidenceRef) fail('FACTORY_QA_UNVERIFIED');
    const live = await access.verify({orderId,tenantId:tenant.tenantId,customerId,buildId:built.buildId});
    if (live?.accessible !== true || !live.evidenceRef) fail('FACTORY_ACCESS_UNVERIFIED');
    // Never claim a sent delivery: this is a pre-delivery evidence bundle only.
    return Object.freeze({status:'READY_FOR_DELIVERY_REVIEW',customerDelivery:false,
      orderId,orderVersion:order.version,orderFingerprint:order.fingerprint,
      tenantId:tenant.tenantId,buildId:built.buildId,templateVersion:built.templateVersion,
      artifactDigest:built.artifactDigest,
      evidence:{provision:tenant.evidenceRef,isolation:isolate.evidenceRef,
        build:built.evidenceRef,qa:passed.evidenceRef,access:live.evidenceRef}});
  }
  return {prepare};
}

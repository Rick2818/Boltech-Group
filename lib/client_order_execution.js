import crypto from 'node:crypto';
import { redisCommand, CAS_SCRIPT } from './rsi_handoff_store.js';
import { getOrderByOrderId } from './payment_store.js';
import { createSdrGmail, SDR_SENDER } from './sdr_gmail.js';
import { isExplicitAcceptance } from './rsi03_closing.js';
import { acceptanceBody } from './customer_acceptance.js';

const fail = (code, statusCode = 409) => { throw Object.assign(new Error(code), { code, statusCode }); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const repo = 'Rick2818/Boltech-Group';
export async function githubDeliveryEvidence(runId, record, fetcher = fetch) {
  if (!Number.isSafeInteger(runId) || runId < 1) fail('DELIVERY_INVALID_RUN');
  async function get(path) {
    const r = await fetcher(`https://api.github.com/repos/${repo}/${path}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) fail('DELIVERY_GITHUB_UNAVAILABLE', 503);
    return r.json();
  }
  const [run, jobs, artifacts] = await Promise.all([get(`actions/runs/${runId}`), get(`actions/runs/${runId}/jobs?per_page=100`), get(`actions/runs/${runId}/artifacts?per_page=100`)]);
  const artifact = artifacts.artifacts?.find(a => a.name === `client-delivery-${record.orderId}-${record.plan.commit}` && !a.expired);
  if (run.repository?.full_name !== repo || run.head_repository?.full_name !== repo || run.head_branch !== 'main' || run.event !== 'workflow_dispatch' || run.path !== '.github/workflows/client_delivery_certification.yml' || !Number.isFinite(Date.parse(run.created_at)) || Date.parse(run.created_at) < Date.parse(record.plan.approvedAt) || !jobs.jobs?.some(j => j.name === 'execute-approved-order' && j.conclusion === 'success') || !artifact || !sha(run.head_sha)) fail('DELIVERY_QA_EVIDENCE_UNVERIFIED');
  return { runId, controlCommit: run.head_sha, commit: record.plan.commit, artifactId: artifact.id, artifactDigest: artifact.digest || null, url: `https://github.com/${repo}/actions/runs/${runId}`, verifiedAt: new Date().toISOString() };
}

// A single durable order; no new database, scheduler, paid model or payment mutation.
export function createClientOrderExecution({ command = redisCommand, gmail = createSdrGmail(), payment = getOrderByOrderId, verifyQa = githubDeliveryEvidence, now = () => new Date().toISOString() } = {}) {
  const key = orderId => { if (!id(orderId)) fail('DELIVERY_INVALID_ORDER', 400); return `boltech:delivery:order:${orderId}`; };
  const read = async orderId => { const raw = await command(['GET', key(orderId)]); return raw ? JSON.parse(raw) : null; };
  async function register(closing) {
    if (!id(closing?.orderId) || !id(closing.opportunityId) || !closing.acceptanceMessageId || !closing.approval?.scope?.acceptanceCriteria?.length) fail('DELIVERY_ACCEPTED_SCOPE_REQUIRED');
    const a = closing.approval;
    const spec = { orderId: closing.orderId, opportunityId: closing.opportunityId, quoteReference: a.quoteReference, customerEmail: a.customerEmail, scope: a.scope, acceptanceMessageId: closing.acceptanceMessageId, approvedAmountUsd: a.approvedAmountUsd, productId: a.productId };
    const fingerprint = digest(spec), existing = await read(spec.orderId);
    if (existing) { if (existing.fingerprint !== fingerprint) fail('DELIVERY_SCOPE_CONFLICT'); return existing; }
    const message = await gmail.message(closing.acceptanceMessageId);
    if (!isExplicitAcceptance(message, closing)) fail('DELIVERY_ACCEPTANCE_UNVERIFIED');
    const record = { ...spec, fingerprint, owner: 'RSI-03', technicalOwner: null, version: 1, createdAt: now(), updatedAt: now(), execution: 'WAITING_IMPLEMENTATION', payment: 'UNVERIFIED', delivery: 'NOT_DELIVERED', customerAcceptance: 'PENDING', events: [], operations: {} };
    if (await command(['SET', key(spec.orderId), JSON.stringify(record), 'NX']) !== 'OK') { const concurrent = await read(spec.orderId); if (concurrent?.fingerprint !== fingerprint) fail('DELIVERY_SCOPE_CONFLICT'); return concurrent; }
    return record;
  }
  async function change(input, update) {
    const record = await read(input.orderId);
    if (!record) fail('DELIVERY_ORDER_NOT_FOUND', 404);
    if (!id(input.eventId)) fail('DELIVERY_EVENT_ID_REQUIRED', 400);
    const {expectedVersion,...event}=input;
    const fingerprint = digest(event), old = record.operations[input.eventId];
    if (old) { if (old !== fingerprint) fail('DELIVERY_EVENT_CONFLICT'); return record; }
    if (input.expectedVersion !== record.version) fail('DELIVERY_VERSION_CONFLICT');
    if (record.events.length >= 200) fail('DELIVERY_EVENT_LIMIT');
    const next = await update(structuredClone(record));
    next.version = record.version + 1; next.updatedAt = now();
    next.operations[input.eventId] = fingerprint;
    next.events.push({ eventId: input.eventId, operation: input.operation, at: now(), execution: next.execution, payment: next.payment, delivery: next.delivery, customerAcceptance: next.customerAcceptance });
    if (await command(['EVAL', CAS_SCRIPT, 1, key(input.orderId), String(record.version), JSON.stringify(next)]) !== 'OK') fail('DELIVERY_VERSION_CONFLICT');
    return next;
  }
  async function act(input) {
    return change(input, async r => {
      if (input.operation === 'approve-plan') {
        if ((r.plan && (r.execution !== 'BLOCKED' || r.delivery !== 'NOT_DELIVERED')) || !id(input.owner) || !sha(input.commit) || !Array.isArray(input.tests) || input.tests.length !== r.scope.acceptanceCriteria.length || !input.tests.every(p => typeof p === 'string' && /^tests\/[A-Za-z0-9_/-]+\.(?:mjs|js)$/.test(p) && !p.includes('..')) || new Set(input.tests).size !== input.tests.length) fail('DELIVERY_APPROVED_PLAN_REQUIRED');
        if(r.plan)r.previousPlans=[...(r.previousPlans||[]),r.plan];
        delete r.qa; delete r.blocker;
        r.technicalOwner = input.owner;
        r.dueAt = new Date(Date.parse(now()) + r.scope.deliveryDays * 86400000).toISOString();
        r.plan = { commit: input.commit, tests: input.tests, approvedAt: now(), criteria: r.scope.acceptanceCriteria };
        r.execution = 'READY_FOR_BUILD_AND_QA';
      } else if (input.operation === 'qa') {
        if(r.execution==='QA_PASSED'&&r.qa?.runId===input.runId)return r;
        if (!r.plan || !['READY_FOR_BUILD_AND_QA', 'BLOCKED'].includes(r.execution)) fail('DELIVERY_PLAN_REQUIRED');
        r.qa = await verifyQa(input.runId, r); r.execution = 'QA_PASSED'; delete r.blocker;
      } else if (input.operation === 'block') {
        if (r.delivery !== 'NOT_DELIVERED' || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500) fail('DELIVERY_INVALID_BLOCK');
        r.blocker = input.reason; r.execution = 'BLOCKED';
      } else if (input.operation === 'payment') {
        const p = await payment(r.orderId);
        if (p?.orderId !== r.orderId || p?.status !== 'PAID' || p.environment !== 'production' || p.productId !== r.productId || p.customerEmail?.toLowerCase() !== r.customerEmail.toLowerCase() || p.expectedAmountUsd !== r.approvedAmountUsd || !p.providerEvidence || !p.paidAt || !(p.providerTransactionId || p.providerInvoiceId)) fail('DELIVERY_PAYMENT_UNVERIFIED');
        r.payment = 'PAID'; r.paymentRef = p.providerTransactionId || p.providerInvoiceId;
      } else if (input.operation === 'deliver') {
        if (r.execution !== 'QA_PASSED' || r.payment !== 'PAID' || r.delivery !== 'NOT_DELIVERED') fail('DELIVERY_NOT_READY');
        const m = await gmail.message(input.messageId);
        const addresses = String(m?.to || '').toLowerCase().match(/[^\s<>;,]+@[^\s<>;,]+/g) || [];
        if (!m?.sent || m.from !== SDR_SENDER || !addresses.includes(r.customerEmail.toLowerCase()) || !m.text?.includes(r.quoteReference) || !m.text?.includes(r.qa.url) || Date.parse(m.receivedAt) < Date.parse(r.qa.verifiedAt) || !Number.isFinite(Date.parse(m.receivedAt))) fail('DELIVERY_SENT_RECEIPT_REQUIRED');
        r.delivery = 'DELIVERED'; r.deliveryMessageId = m.id; r.deliveryThreadId = m.threadId; r.deliveredAt = m.receivedAt;
      } else if (input.operation === 'accept-delivery') {
        if (r.delivery !== 'DELIVERED') fail('DELIVERY_NOT_DELIVERED');
        const m = await gmail.message(input.messageId);
        if (m?.from !== r.customerEmail.toLowerCase() || m.sent || m.automatic || m.threadId !== r.deliveryThreadId || !Number.isFinite(Date.parse(m.receivedAt)) || Date.parse(m.receivedAt) < Date.parse(r.deliveredAt) || acceptanceBody(m.text) !== `ACEPTO ENTREGA ${r.orderId}`) fail('DELIVERY_CUSTOMER_ACCEPTANCE_REQUIRED');
        r.customerAcceptance = 'ACCEPTED'; r.deliveryAcceptanceMessageId = m.id;
      } else fail('DELIVERY_OPERATION_INVALID', 400);
      return r;
    });
  }
  async function fromOpportunity(opportunityId) {
    if (!id(opportunityId)) fail('DELIVERY_INVALID_OPPORTUNITY', 400);
    const raw = await command(['GET', `boltech:closing:case:${opportunityId}`]);
    if (!raw) fail('DELIVERY_CLOSING_NOT_FOUND', 404);
    return register(JSON.parse(raw));
  }
  return { read, register, act, fromOpportunity };
}

// Isolated technical probe: no customer, email, payment or commercial index.
export async function checkClientOrderStorage(command=redisCommand){
 const key=`boltech:qa:delivery:${crypto.randomUUID()}`;
 const cas="local raw=redis.call('GET',KEYS[1]);if not raw then return 'MISSING' end;local r=cjson.decode(raw);if r.version~=tonumber(ARGV[1]) then return 'CONFLICT' end;redis.call('SET',KEYS[1],ARGV[2],'KEEPTTL');return 'OK'";
 try{
  if(await command(['SET',key,JSON.stringify({version:1,kind:'TECHNICAL_STORAGE_PROBE'}),'NX','EX',120])!=='OK')fail('DELIVERY_STORAGE_CHECK_FAILED',503);
  if(JSON.parse(await command(['GET',key])).version!==1)fail('DELIVERY_STORAGE_READBACK_FAILED',503);
  if(await command(['EVAL',cas,1,key,'1',JSON.stringify({version:2,kind:'TECHNICAL_STORAGE_PROBE'})])!=='OK')fail('DELIVERY_STORAGE_CAS_FAILED',503);
  if(await command(['EVAL',cas,1,key,'1','{}'])!=='CONFLICT')fail('DELIVERY_STORAGE_CONFLICT_GUARD_FAILED',503);
  if(JSON.parse(await command(['GET',key])).version!==2)fail('DELIVERY_STORAGE_READBACK_FAILED',503);
  return {status:'VERIFIED',scope:'PRODUCTION_STORAGE_ONLY',readback:true,atomicVersionGuard:true,customerDeliveryCertified:false};
 }finally{await command(['DEL',key]);}
}

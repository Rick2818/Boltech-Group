import crypto from 'node:crypto';
import { taskIdentity, claimTask, completeTask, readTask } from '../lib/a2a_task_store.js';
import { normalizeReferralInput, generateActivityId, scorePartnerMatch } from '../lib/partner_network.js';
import {
  listPartners,
  createReferral,
  logPartnerActivity,
  findA2APartnerByKeyHash
} from '../lib/airtable_partner_store.js';

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

function clean(v, n = 5000) {
  return v == null ? '' : String(v).trim().slice(0, n);
}

function bearerToken(req) {
  const auth = clean(req.headers?.authorization, 2200);
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}

function rpcId(body) { return ['string', 'number'].includes(typeof body?.id) ? body.id : null; }

async function authenticatedPartner(req) {
  const supplied = bearerToken(req);
  if (!supplied) return null;
  return await findA2APartnerByKeyHash(sha256Hex(supplied));
}

function extractCard(body) {
  const parts = body?.params?.message?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (part && typeof part.data === 'object' && part.data && !Array.isArray(part.data)) return part.data;
  }
  return null;
}

async function intake(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'POST required' });
  }
  const body = req.body || {};
  const id = rpcId(body);

  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string' || Array.isArray(body) || !['string', 'number'].includes(typeof body.id)) {
    return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid A2A request' } });
  }

  const source = await authenticatedPartner(req);
  if (!source) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Boltech A2A"');
    return send(res, 401, { jsonrpc: '2.0', id, error: { code: -32001, message: 'A2A authentication required' } });
  }

  if (body.method === 'GetTask') {
    const taskId = body.params?.id;
    if (typeof taskId !== 'string' || !/^[a-f0-9]{64}$/.test(taskId)) {
      return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid task id' } });
    }
    const stored = await readTask(source.id, taskId);
    if (!stored) return send(res, 404, { jsonrpc: '2.0', id, error: { code: -32004, message: 'Task not found' } });
    if (stored.state !== 'completed') return send(res, 409, { jsonrpc: '2.0', id, error: { code: -32009, message: 'Task registration incomplete; operator review required', data: { taskId } } });
    return send(res, 200, { jsonrpc: '2.0', id, result: stored.task });
  }
  if (!['SendMessage', 'message/send'].includes(body.method)) {
    return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  }
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 65536) return send(res, 413, { jsonrpc: '2.0', id, error: { code: -32602, message: 'Request exceeds 64 KiB' } });
  const message = body.params?.message;
  if (typeof message?.messageId !== 'string' || !message.messageId.trim() || message.messageId.length > 120 ||
      !(message.role === 'ROLE_USER' || (body.method === 'message/send' && message.role === 'user')) ||
      (message.contextId !== undefined && (typeof message.contextId !== 'string' || message.contextId.length > 120))) {
    return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32602, message: 'messageId and user role are required; contextId must be a string' } });
  }
  if (message.taskId) return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32602, message: 'Use a new messageId to register a new need; existing tasks cannot be restarted' } });
  const card = extractCard(body);
  if (!card || card.type !== 'boltech.referral.need.v1') {
    return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32602, message: 'Expected boltech.referral.need.v1 data part' } });
  }

  if (card.clientConsent !== undefined && typeof card.clientConsent !== 'boolean') {
    return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32602, message: 'clientConsent must be a JSON boolean' } });
  }
  if (typeof card.needSummary !== 'string' || (card.budgetUsd != null && (typeof card.budgetUsd !== 'number' || !Number.isFinite(card.budgetUsd)))) {
    return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32602, message: 'needSummary must be text and budgetUsd must be a number' } });
  }
  let referral;
  try {
    referral = normalizeReferralInput({
      partnerRecordId: source.id,
      direction: 'INBOUND_TO_BOLTECH',
      status: card.clientConsent === true ? 'REVIEW' : 'WAITING_CONSENT',
      serviceType: clean(card.serviceType, 120) || 'Custom Agent',
      needSummary: clean(card.needSummary, 10000),
      budgetUsd: card.budgetUsd,
      clientConsent: card.clientConsent === true,
      clientCompany: clean(card.clientCompany, 250),
      clientContact: clean(card.clientContact, 250),
      clientEmail: clean(card.clientEmail, 320),
      source: 'A2A',
      notes: clean(card.notes, 5000)
    });
  } catch {
    return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid referral fields: check service, need summary, budget and consented email' } });
  }
  const taskId = taskIdentity(source.id, message.messageId);
  const fingerprint = sha256Hex(JSON.stringify(canonical({ card, contextId: message.contextId || '' })));
  const claim = await claimTask(source.id, taskId, fingerprint);
  if (!claim.claimed) {
    if (claim.existing?.fingerprint !== fingerprint) return send(res, 409, { jsonrpc: '2.0', id, error: { code: -32009, message: 'messageId already used with different content' } });
    if (claim.existing?.state !== 'completed') return send(res, 409, { jsonrpc: '2.0', id, error: { code: -32009, message: 'Task registration incomplete; operator review required', data: { taskId } } });
    return send(res, 200, { jsonrpc: '2.0', id, result: body.method === 'SendMessage' ? { task: claim.existing.task } : legacyTask(claim.existing.task) });
  }
  const partners = await listPartners();
  const requestShape = {
    serviceType: referral.serviceType,
    market: clean(card.market, 120),
    language: clean(card.language, 120)
  };

  const matches = partners
    .filter(p => p.id !== source.id)
    .map(p => ({
      id: p.id,
      name: p.name,
      score: scorePartnerMatch(p, requestShape),
      relationshipStatus: p.status,
      a2aEnabled: Boolean(p.a2aEnabled)
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const providerCandidates = partners
    .filter(p => p.id !== source.id && p.status === 'PROSPECT')
    .map(p => ({
      id: p.id,
      name: p.name,
      score: scorePartnerMatch({ ...p, status: 'ACTIVE' }, requestShape),
      relationshipStatus: 'PROSPECT',
      a2aEnabled: false,
      requiresEnrollment: true
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const rec = await createReferral({
    ...referral,
    requestMarket: clean(card.market, 120),
    requestLanguage: clean(card.language, 120),
    urgency: clean(card.urgency || 'FLEXIBLE', 50).toUpperCase(),
    a2aTaskId: taskId
  });
  if (typeof rec.id !== 'string' || !rec.id) throw new Error('Referral storage did not acknowledge registration');

  const activity = await logPartnerActivity({
    activityId: generateActivityId(),
    partnerRecordId: source.id,
    referralRecordId: rec.id,
    channel: 'A2A',
    activityType: 'REFERRAL_RECEIVED',
    summary: 'A2A referral registered with customer PII ' + (referral.clientConsent ? 'consented' : 'masked') + '.',
    outcome: 'PENDING'
  });
  if (typeof activity.id !== 'string' || !activity.id) throw new Error('Activity storage did not acknowledge registration');

  const task = {
      id: taskId,
      contextId: clean(body?.params?.message?.contextId, 120) || crypto.randomUUID(),
      status: { state: 'TASK_STATE_COMPLETED' },
      artifacts: [{
        artifactId: crypto.randomUUID(),
        name: 'Boltech Referral Registration',
        parts: [{
          mediaType: 'application/json',
          data: {
            referralId: referral.referralId,
            status: referral.status,
            piiShared: referral.clientConsent,
            matchedPartners: matches,
            providerCandidates
          }
        }]
      }]
  };
  await completeTask(source.id, taskId, fingerprint, task);
  return send(res, 200, { jsonrpc: '2.0', id, result: body.method === 'SendMessage' ? { task } : legacyTask(task) });
}

function legacyTask(task) {
  return { ...task, kind: 'task', status: { ...task.status, state: 'completed' }, artifacts: task.artifacts.map(a => ({ ...a, parts: a.parts.map(p => ({ ...p, kind: 'data' })) })) };
}

export default async function handler(req, res) {
  try {
    return await intake(req, res);
  } catch {
    // Never expose provider errors, credentials or submitted PII.
    return send(res, 503, { jsonrpc: '2.0', id: rpcId(req.body), error: { code: -32000, message: 'A2A storage unavailable or registration incomplete. Retry with the same messageId; do not create a new request.' } });
  }
}

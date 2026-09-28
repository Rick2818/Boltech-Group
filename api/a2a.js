import crypto from 'node:crypto';
import { normalizeReferralInput, generateActivityId, scorePartnerMatch } from '../lib/partner_network.js';
import { listPartners, createReferral, logPartnerActivity } from '../lib/airtable_partner_store.js';

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

function clean(v, n = 5000) {
  return v == null ? '' : String(v).trim().slice(0, n);
}

function authorized(req) {
  const expected = clean(process.env.A2A_API_TOKEN || process.env.PARTNER_API_TOKEN, 2000);
  const auth = clean(req.headers?.authorization, 2200);
  const supplied = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function extractCard(body) {
  const parts = body?.params?.message?.parts || [];
  for (const part of parts) {
    if (part && typeof part.data === 'object' && part.data) return part.data;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
  const body = req.body || {};
  const id = body.id ?? null;

  if (body.jsonrpc !== '2.0' || !['SendMessage', 'message/send'].includes(body.method)) {
    return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid A2A request' } });
  }
  if (!authorized(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Boltech A2A"');
    return send(res, 401, { jsonrpc: '2.0', id, error: { code: -32001, message: 'A2A authentication required' } });
  }

  const card = extractCard(body);
  if (!card || card.type !== 'boltech.referral.need.v1') {
    return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32602, message: 'Expected boltech.referral.need.v1 data part' } });
  }

  const partners = await listPartners();
  const source = partners.find(p => p.id === clean(card.partnerRecordId, 120) && p.status === 'ACTIVE' && p.a2aEnabled);
  if (!source) {
    return send(res, 403, { jsonrpc: '2.0', id, error: { code: -32003, message: 'Active A2A partner required' } });
  }

  const referral = normalizeReferralInput({
    partnerRecordId: source.id,
    direction: 'INBOUND_TO_BOLTECH',
    status: card.clientConsent ? 'REVIEW' : 'WAITING_CONSENT',
    serviceType: clean(card.serviceType, 120) || 'Custom Agent',
    needSummary: clean(card.needSummary, 10000),
    budgetUsd: card.budgetUsd,
    clientConsent: Boolean(card.clientConsent),
    clientCompany: clean(card.clientCompany, 250),
    clientContact: clean(card.clientContact, 250),
    clientEmail: clean(card.clientEmail, 320),
    source: 'A2A',
    notes: clean(card.notes, 5000)
  });

  const matches = partners
    .filter(p => p.id !== source.id)
    .map(p => ({ id: p.id, name: p.name, score: scorePartnerMatch(p, {
      serviceType: referral.serviceType,
      market: clean(card.market, 120),
      language: clean(card.language, 120)
    }) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const taskId = clean(card.taskId, 120) || crypto.randomUUID();
  const rec = await createReferral({
    ...referral,
    requestMarket: clean(card.market, 120),
    requestLanguage: clean(card.language, 120),
    urgency: clean(card.urgency || 'FLEXIBLE', 50).toUpperCase(),
    a2aTaskId: taskId
  });

  await logPartnerActivity({
    activityId: generateActivityId(),
    partnerRecordId: source.id,
    referralRecordId: rec.id,
    channel: 'A2A',
    activityType: 'REFERRAL_RECEIVED',
    summary: 'A2A referral registered with customer PII ' + (referral.clientConsent ? 'consented' : 'masked') + '.',
    outcome: 'PENDING'
  });

  return send(res, 200, {
    jsonrpc: '2.0',
    id,
    result: {
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
            matchedPartners: matches
          }
        }]
      }]
    }
  });
}

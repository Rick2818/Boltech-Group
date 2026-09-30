import crypto from 'node:crypto';

export const PARTNER_TYPES = Object.freeze([
  'AI Platform',
  'Agency',
  'Builder',
  'Consultant',
  'Referral Partner',
  'Technology Partner'
]);

export const PARTNER_STATUSES = Object.freeze([
  'PROSPECT',
  'INVITED',
  'ACTIVE',
  'PAUSED',
  'DECLINED'
]);

export const REFERRAL_STATUSES = Object.freeze([
  'NEW',
  'REVIEW',
  'ACCEPTED',
  'WAITING_CONSENT',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
  'REJECTED'
]);

export const REFERRAL_DIRECTIONS = Object.freeze([
  'INBOUND_TO_BOLTECH',
  'OUTBOUND_FROM_BOLTECH'
]);

export const SERVICE_TYPES = Object.freeze([
  'Custom Agent',
  'Prebuilt Agent',
  'Sales Agent',
  'Support Agent',
  'WhatsApp Agent',
  'Voice Agent',
  'CRM Integration',
  'Workflow Automation'
]);

export const DEAL_REGISTRATION_SOURCES = Object.freeze([
  'Partner Portal',
  'Partner API',
  'Manual',
  'Email',
  'A2A'
]);

export const STATUS_TRANSITIONS = Object.freeze({
  NEW: ['REVIEW', 'REJECTED'],
  REVIEW: ['ACCEPTED', 'WAITING_CONSENT', 'REJECTED'],
  ACCEPTED: ['WAITING_CONSENT', 'QUALIFIED', 'REJECTED'],
  WAITING_CONSENT: ['QUALIFIED', 'REJECTED'],
  QUALIFIED: ['PROPOSAL', 'LOST', 'REJECTED'],
  PROPOSAL: ['NEGOTIATION', 'WON', 'LOST'],
  NEGOTIATION: ['WON', 'LOST'],
  WON: [],
  LOST: [],
  REJECTED: []
});

export function clampCommissionRate(rate, fallback = 0.20) {
  const parsed = Number(rate);
  const selected = Number.isFinite(parsed) ? parsed : Number(fallback);
  if (!Number.isFinite(selected) || selected < 0 || selected > 1) {
    throw new Error('Commission rate must be between 0 and 1.');
  }
  return Math.round(selected * 10000) / 10000;
}

export function calculateCommission(revenueUsd, commissionRate) {
  const revenue = Number(revenueUsd);
  if (!Number.isFinite(revenue) || revenue < 0) {
    throw new Error('Revenue USD must be a non-negative number.');
  }
  const rate = clampCommissionRate(commissionRate);
  return Math.round((revenue * rate + Number.EPSILON) * 100) / 100;
}

export function generateReferralId(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BOL-REF-${date}-${suffix}`;
}

export function generateActivityId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BOL-ACT-${stamp}-${suffix}`;
}

export function assertAllowed(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new Error(`${fieldName} is invalid. Allowed values: ${allowed.join(', ')}`);
  }
  return value;
}

export function assertValidTransition(fromStatus, toStatus) {
  assertAllowed(fromStatus, REFERRAL_STATUSES, 'Current status');
  assertAllowed(toStatus, REFERRAL_STATUSES, 'Target status');
  if (fromStatus === toStatus) return true;
  const allowed = STATUS_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error(`Invalid referral transition: ${fromStatus} -> ${toStatus}`);
  }
  return true;
}

function cleanText(value, maxLength = 5000) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
}

export function normalizeReferralInput(input = {}, defaultCommissionRate = 0.20) {
  const clientConsent = input.clientConsent === true || input.clientConsent === 'true';
  const direction = input.direction || 'INBOUND_TO_BOLTECH';
  const status = input.status || (clientConsent ? 'REVIEW' : 'WAITING_CONSENT');
  const source = input.source || input.dealRegistrationSource || 'Partner API';
  const serviceType = input.serviceType || 'Custom Agent';

  assertAllowed(direction, REFERRAL_DIRECTIONS, 'Direction');
  assertAllowed(status, REFERRAL_STATUSES, 'Status');
  assertAllowed(source, DEAL_REGISTRATION_SOURCES, 'Deal registration source');
  assertAllowed(serviceType, SERVICE_TYPES, 'Service type');

  const budget = input.budgetUsd === '' || input.budgetUsd == null ? null : Number(input.budgetUsd);
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    throw new Error('Budget USD must be a non-negative number.');
  }

  const normalized = {
    referralId: cleanText(input.referralId, 120) || generateReferralId(),
    partnerRecordId: cleanText(input.partnerRecordId, 120),
    leadRecordId: cleanText(input.leadRecordId, 120),
    direction,
    status,
    serviceType,
    needSummary: cleanText(input.needSummary, 10000),
    budgetUsd: budget,
    clientConsent,
    clientCompany: cleanText(input.clientCompany, 250),
    clientContact: cleanText(input.clientContact, 250),
    clientEmail: cleanText(input.clientEmail, 320).toLowerCase(),
    commissionRate: clampCommissionRate(input.commissionRate, defaultCommissionRate),
    source,
    notes: cleanText(input.notes, 10000)
  };

  if (!normalized.partnerRecordId) throw new Error('partnerRecordId is required.');
  if (!normalized.needSummary) throw new Error('needSummary is required.');

  // Proven partner programs register an opportunity before exposing customer PII.
  // Boltech enforces the same handoff boundary: no customer identity without consent.
  if (!clientConsent) {
    normalized.clientCompany = '';
    normalized.clientContact = '';
    normalized.clientEmail = '';
    if (!['NEW', 'REVIEW', 'ACCEPTED', 'WAITING_CONSENT'].includes(normalized.status)) {
      normalized.status = 'WAITING_CONSENT';
    }
  } else if (normalized.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.clientEmail)) {
    throw new Error('Client email is invalid.');
  }

  return normalized;
}

export function buildWonUpdate({ revenueUsd, commissionRate }) {
  const revenue = Number(revenueUsd);
  const rate = clampCommissionRate(commissionRate);
  return {
    status: 'WON',
    revenueUsd: revenue,
    commissionRate: rate,
    commissionUsd: calculateCommission(revenue, rate)
  };
}

function normalizeMulti(value) {
  if (Array.isArray(value)) {
    return value.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean);
  }
  if (!value) return [];
  return String(value).split(',').map(x => x.trim()).filter(Boolean);
}

const SERVICE_CAPABILITY_MAP = Object.freeze({
  'Custom Agent': ['Custom Agents', 'API Integration', 'Workflow Automation'],
  'Prebuilt Agent': ['Prebuilt Agents'],
  'Sales Agent': ['Sales Agents', 'CRM'],
  'Support Agent': ['Customer Support'],
  'WhatsApp Agent': ['WhatsApp', 'Customer Support'],
  'Voice Agent': ['Voice Agents'],
  'CRM Integration': ['CRM', 'API Integration'],
  'Workflow Automation': ['Workflow Automation', 'API Integration']
});

export function scorePartnerMatch(partner = {}, request = {}) {
  if ((partner.status || partner.Status) !== 'ACTIVE') return 0;

  const capabilities = normalizeMulti(partner.capabilities || partner.Capabilities);
  const markets = normalizeMulti(partner.markets || partner.Markets);
  const languages = normalizeMulti(partner.languages || partner.Languages);
  const desiredCaps = SERVICE_CAPABILITY_MAP[request.serviceType] || [request.serviceType].filter(Boolean);

  let score = 10;
  const capabilityMatches = desiredCaps.filter(cap => capabilities.includes(cap)).length;
  if (capabilityMatches === 0) return 0;
  score += capabilityMatches * 25;

  if (request.market && (markets.includes(request.market) || markets.includes('Global'))) score += 15;
  if (request.language && languages.includes(request.language)) score += 15;
  if ((partner.referralMode || partner['Referral Mode']) === 'BIDIRECTIONAL') score += 5;

  return Math.min(score, 100);
}

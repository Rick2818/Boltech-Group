import crypto from 'node:crypto';
import {
  PARTNER_TYPES,
  PARTNER_STATUSES,
  REFERRAL_STATUSES,
  REFERRAL_DIRECTIONS,
  SERVICE_TYPES,
  clampCommissionRate,
  normalizeReferralInput,
  assertValidTransition,
  scorePartnerMatch,
  generateActivityId
} from '../lib/partner_network.js';
import {
  PartnerStoreConfigurationError,
  getPartnerStoreReadiness,
  listPartners,
  listReferrals,
  listCommissionLedger,
  createPartner,
  createReferral,
  createCommissionEntry,
  updateReferral,
  logPartnerActivity,
  getPartnerMetrics
} from '../lib/airtable_partner_store.js';
import { getVerifiedSalesMetrics } from '../lib/payment_store.js';

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function cleanText(value, maxLength = 5000) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function configuredWriteToken() {
  return cleanText(process.env.PARTNER_API_TOKEN || process.env.COCKPIT_ACCESS_TOKEN, 1000);
}

function incomingWriteToken(req) {
  const auth = cleanText(req.headers?.authorization, 1200);
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return cleanText(req.headers?.['x-partner-api-token'], 1000);
}

function requireWriteAuth(req, res) {
  const expected = configuredWriteToken();
  if (!expected) {
    json(res, 503, {
      success: false,
      error: 'Partner write API is not configured.',
      code: 'PARTNER_AUTH_NOT_CONFIGURED'
    });
    return false;
  }
  if (!timingSafeEqualText(incomingWriteToken(req), expected)) {
    json(res, 401, { success: false, error: 'Unauthorized', code: 'PARTNER_AUTH_REQUIRED' });
    return false;
  }
  return true;
}

function actionFromRequest(req) {
  const url = new URL(req.url, 'https://' + (req.headers?.host || 'localhost'));
  const fromQuery = cleanText(url.searchParams.get('action') || url.searchParams.get('route'), 120);
  if (fromQuery) return fromQuery.replace(/^\/+|\/+$/g, '').toLowerCase();

  const pathname = url.pathname.replace(/\/+$/, '');
  const marker = '/api/partners/';
  if (pathname.startsWith(marker)) return pathname.slice(marker.length).toLowerCase();
  return 'health';
}

function activityChannel(source) {
  if (source === 'A2A') return 'A2A';
  if (source === 'Email') return 'Email';
  if (source === 'Manual') return 'Manual';
  if (source === 'Partner Portal') return 'Partner Portal';
  return 'API';
}

function publicMetricsShape(metrics) {
  return {
    partners: metrics.partners,
    referrals: metrics.referrals,
    finance: metrics.finance,
    generatedAt: new Date().toISOString()
  };
}

function validatePartnerInput(body = {}) {
  const name = cleanText(body.name, 250);
  if (!name) throw new Error('Partner name is required.');

  const partnerType = cleanText(body.partnerType || 'Referral Partner', 120);
  if (!PARTNER_TYPES.includes(partnerType)) throw new Error('Invalid partner type.');

  const status = cleanText(body.status || 'PROSPECT', 120).toUpperCase();
  if (!PARTNER_STATUSES.includes(status)) throw new Error('Invalid partner status.');

  const contactEmail = cleanText(body.contactEmail, 320).toLowerCase();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error('Partner email is invalid.');
  }

  return {
    name,
    companyUrl: cleanText(body.companyUrl, 500),
    contactEmail,
    partnerType,
    status,
    capabilities: Array.isArray(body.capabilities) ? body.capabilities.slice(0, 20) : ['Custom Agents'],
    markets: Array.isArray(body.markets) ? body.markets.slice(0, 20) : ['Global'],
    languages: Array.isArray(body.languages) ? body.languages.slice(0, 10) : ['Spanish', 'English'],
    referralMode: cleanText(body.referralMode || 'BIDIRECTIONAL', 120),
    commissionRate: clampCommissionRate(body.commissionRate, 0.20),
    agentCardUrl: cleanText(body.agentCardUrl, 500),
    notes: cleanText(body.notes, 10000),
    lastContact: cleanText(body.lastContact, 120)
  };
}

async function findReferral(recordId) {
  const referrals = await listReferrals();
  const referral = referrals.find(item => item.id === recordId);
  if (!referral) {
    const error = new Error('Referral record not found.');
    error.statusCode = 404;
    throw error;
  }
  return referral;
}

export default async function partnersHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = actionFromRequest(req);
    const readiness = getPartnerStoreReadiness();

    if (req.method === 'GET' && (action === 'health' || action === '')) {
      return json(res, 200, {
        success: true,
        service: 'Boltech Partner Network',
        airtableConfigured: readiness.configured,
        writeAuthConfigured: Boolean(configuredWriteToken()),
        mode: 'partner-referral-co-selling',
        safeguards: {
          customerConsentGate: true,
          humanApprovalForContractsAndMoney: true,
          piiBeforeConsent: false
        }
      });
    }

    if (!readiness.configured) {
      return json(res, 503, {
        success: false,
        error: 'Partner Network storage is not configured.',
        code: 'AIRTABLE_NOT_CONFIGURED'
      });
    }

    if (req.method === 'GET' && action === 'metrics') {
      const metrics = await getPartnerMetrics();
      return json(res, 200, { success: true, metrics: publicMetricsShape(metrics) });
    }

    if (req.method === 'GET' && action === 'commercial-metrics') {
      if (!requireWriteAuth(req, res)) return;
      const [metrics, verifiedSales] = await Promise.all([getPartnerMetrics(), getVerifiedSalesMetrics()]);
      return json(res, 200, {
        success: true,
        metrics: {
          ...publicMetricsShape(metrics),
          verifiedSales,
          definition: 'Verified production payment orders only; WON revenue and pipeline are not cash collected.'
        }
      });
    }

    if (req.method === 'GET' && action === 'partners') {
      if (!requireWriteAuth(req, res)) return;
      return json(res, 200, { success: true, partners: await listPartners() });
    }

    if (req.method === 'GET' && action === 'referrals') {
      if (!requireWriteAuth(req, res)) return;
      return json(res, 200, { success: true, referrals: await listReferrals() });
    }

    if (req.method === 'GET' && action === 'commissions') {
      if (!requireWriteAuth(req, res)) return;
      return json(res, 200, { success: true, commissions: await listCommissionLedger() });
    }

    if (req.method === 'GET' && action === 'match') {
      if (!requireWriteAuth(req, res)) return;
      const url = new URL(req.url, 'https://' + (req.headers?.host || 'localhost'));
      const serviceType = cleanText(url.searchParams.get('serviceType'), 120);
      const market = cleanText(url.searchParams.get('market'), 120);
      const language = cleanText(url.searchParams.get('language'), 120);
      if (serviceType && !SERVICE_TYPES.includes(serviceType)) {
        return json(res, 400, { success: false, error: 'Invalid service type.' });
      }
      const partners = await listPartners();
      const matches = partners
        .map(partner => ({
          id: partner.id,
          name: partner.name,
          partnerType: partner.partnerType,
          capabilities: partner.capabilities,
          markets: partner.markets,
          languages: partner.languages,
          referralMode: partner.referralMode,
          score: scorePartnerMatch(partner, { serviceType, market, language })
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      return json(res, 200, { success: true, matches });
    }

    if (req.method === 'POST' && action === 'partner') {
      if (!requireWriteAuth(req, res)) return;
      const partnerInput = validatePartnerInput(req.body || {});
      const record = await createPartner(partnerInput);
      await logPartnerActivity({
        activityId: generateActivityId(),
        partnerRecordId: record.id,
        channel: 'Manual',
        activityType: 'INTRODUCTION',
        summary: 'Partner registered in Boltech Partner Network.',
        outcome: 'COMPLETED'
      });
      return json(res, 201, { success: true, partner: { id: record.id, ...partnerInput } });
    }

    if (req.method === 'POST' && action === 'referral') {
      if (!requireWriteAuth(req, res)) return;
      const referralInput = normalizeReferralInput(req.body || {});
      const record = await createReferral(referralInput);
      await logPartnerActivity({
        activityId: generateActivityId(),
        partnerRecordId: referralInput.partnerRecordId,
        referralRecordId: record.id,
        channel: activityChannel(referralInput.source),
        activityType: referralInput.direction === 'INBOUND_TO_BOLTECH' ? 'REFERRAL_RECEIVED' : 'REFERRAL_REQUEST',
        summary: 'Referral registered: ' + referralInput.referralId + ' / ' + referralInput.serviceType,
        outcome: 'PENDING'
      });
      return json(res, 201, {
        success: true,
        referral: {
          id: record.id,
          referralId: referralInput.referralId,
          status: referralInput.status,
          clientConsent: referralInput.clientConsent
        }
      });
    }

    if (req.method === 'POST' && action === 'transition') {
      if (!requireWriteAuth(req, res)) return;
      const body = req.body || {};
      const recordId = cleanText(body.recordId, 120);
      const targetStatus = cleanText(body.status, 120).toUpperCase();
      if (!recordId) return json(res, 400, { success: false, error: 'recordId is required.' });
      if (!REFERRAL_STATUSES.includes(targetStatus)) {
        return json(res, 400, { success: false, error: 'Invalid referral status.' });
      }

      const current = await findReferral(recordId);
      assertValidTransition(current.status, targetStatus);

      const clientConsent = body.clientConsent === undefined ? current.clientConsent : Boolean(body.clientConsent);
      if (targetStatus === 'QUALIFIED' && !clientConsent) {
        return json(res, 409, {
          success: false,
          error: 'Customer consent is required before a referral can be QUALIFIED.',
          code: 'CONSENT_REQUIRED'
        });
      }

      const patch = { status: targetStatus };
      if (body.clientConsent !== undefined) patch.clientConsent = clientConsent;
      if (clientConsent) {
        if (body.clientCompany !== undefined) patch.clientCompany = cleanText(body.clientCompany, 250);
        if (body.clientContact !== undefined) patch.clientContact = cleanText(body.clientContact, 250);
        if (body.clientEmail !== undefined) {
          const email = cleanText(body.clientEmail, 320).toLowerCase();
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json(res, 400, { success: false, error: 'Client email is invalid.' });
          }
          patch.clientEmail = email;
        }
      }
      if (body.notes !== undefined) patch.notes = cleanText(body.notes, 10000);

      await updateReferral(recordId, patch);
      await logPartnerActivity({
        activityId: generateActivityId(),
        partnerRecordId: current.partnerRecordIds?.[0] || '',
        referralRecordId: recordId,
        channel: 'Manual',
        activityType: targetStatus === 'PROPOSAL' ? 'PROPOSAL' : (targetStatus === 'LOST' ? 'CLOSED_LOST' : 'QUALIFICATION'),
        summary: 'Referral status changed from ' + current.status + ' to ' + targetStatus + '.',
        outcome: targetStatus === 'LOST' ? 'NEGATIVE' : 'COMPLETED'
      });
      return json(res, 200, { success: true, referral: { id: recordId, status: targetStatus } });
    }

    if (req.method === 'POST' && action === 'won') {
      if (!requireWriteAuth(req, res)) return;
      const body = req.body || {};
      const recordId = cleanText(body.recordId, 120);
      const revenueUsd = Number(body.revenueUsd);
      if (!recordId) return json(res, 400, { success: false, error: 'recordId is required.' });
      if (!Number.isFinite(revenueUsd) || revenueUsd <= 0) {
        return json(res, 400, { success: false, error: 'revenueUsd must be greater than zero.' });
      }

      const current = await findReferral(recordId);
      assertValidTransition(current.status, 'WON');
      if (!current.clientConsent) {
        return json(res, 409, { success: false, error: 'Customer consent is required before closing WON.', code: 'CONSENT_REQUIRED' });
      }

      // WON means the commercial deal is closed. It does NOT mean cash was collected.
      // Commission is intentionally NOT generated here. It is created only when an
      // actual customer payment is recorded through the commission-entry route.
      const wonUpdate = { status: 'WON', revenueUsd };
      await updateReferral(recordId, wonUpdate);
      await logPartnerActivity({
        activityId: generateActivityId(),
        partnerRecordId: current.partnerRecordIds?.[0] || '',
        referralRecordId: recordId,
        channel: 'Manual',
        activityType: 'CLOSED_WON',
        summary: 'Referral closed WON. Contract revenue USD ' + revenueUsd + '. Commission deferred until cash collection is recorded.',
        outcome: 'COMPLETED'
      });
      return json(res, 200, {
        success: true,
        referral: { id: recordId, ...wonUpdate },
        commissionCreated: false,
        commissionPolicy: 'CASH_COLLECTED_ONLY'
      });
    }

    if (req.method === 'POST' && action === 'commission-entry') {
      if (!requireWriteAuth(req, res)) return;
      const body = req.body || {};
      const referralRecordId = cleanText(body.referralRecordId, 120);
      const customerPaymentReference = cleanText(body.customerPaymentReference, 250);
      const cashCollectedUsd = Number(body.cashCollectedUsd);

      if (!referralRecordId) return json(res, 400, { success: false, error: 'referralRecordId is required.' });
      if (!customerPaymentReference) return json(res, 400, { success: false, error: 'customerPaymentReference is required as real payment evidence.' });
      if (!Number.isFinite(cashCollectedUsd) || cashCollectedUsd <= 0) {
        return json(res, 400, { success: false, error: 'cashCollectedUsd must be greater than zero.' });
      }

      const referral = await findReferral(referralRecordId);
      if (referral.status !== 'WON') {
        return json(res, 409, { success: false, error: 'Commission entries require a WON referral.', code: 'REFERRAL_NOT_WON' });
      }

      const commissionRate = clampCommissionRate(body.commissionRate ?? referral.commissionRate ?? 0.20, 0.20);
      const partnerRecordId = referral.partnerRecordIds?.[0] || '';
      if (!partnerRecordId) {
        return json(res, 409, { success: false, error: 'Referral has no partner attribution.', code: 'PARTNER_ATTRIBUTION_REQUIRED' });
      }

      const commissionEntryId = 'COM-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const record = await createCommissionEntry({
        commissionEntryId,
        referralRecordId,
        partnerRecordId,
        customerPaymentReference,
        cashCollectedUsd,
        commissionRate,
        status: 'PENDING_APPROVAL',
        collectedAt: cleanText(body.collectedAt, 120) || new Date().toISOString(),
        notes: cleanText(body.notes, 10000)
      });

      await logPartnerActivity({
        activityId: generateActivityId(),
        partnerRecordId,
        referralRecordId,
        channel: 'Manual',
        activityType: 'FOLLOW_UP',
        summary: 'Cash collection recorded for commission review: USD ' + cashCollectedUsd + '. Entry ' + commissionEntryId + '.',
        outcome: 'PENDING'
      });

      return json(res, 201, {
        success: true,
        commission: {
          id: record.id,
          commissionEntryId,
          referralRecordId,
          partnerRecordId,
          cashCollectedUsd,
          commissionRate,
          commissionEarnedUsd: Math.round(cashCollectedUsd * commissionRate * 100) / 100,
          status: 'PENDING_APPROVAL'
        }
      });
    }

    return json(res, 404, { success: false, error: 'Partner Network route not found.' });
  } catch (error) {
    const status = error instanceof PartnerStoreConfigurationError
      ? 503
      : (Number(error?.statusCode) || (/invalid|required|must be/i.test(error?.message || '') ? 400 : 500));

    console.error('[PARTNER NETWORK]', error?.message || error);
    return json(res, status, {
      success: false,
      error: status >= 500 ? 'Partner Network request failed.' : (error?.message || 'Invalid request.')
    });
  }
}

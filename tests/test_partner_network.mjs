import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampCommissionRate,
  calculateCommission,
  normalizeReferralInput,
  assertValidTransition,
  buildWonUpdate,
  scorePartnerMatch
} from '../lib/partner_network.js';

test('commission rate clamps only valid rates and commission is exact to cents', () => {
  assert.equal(clampCommissionRate(0.20), 0.20);
  assert.equal(calculateCommission(1000, 0.20), 200);
  assert.throws(() => clampCommissionRate(1.2), /between 0 and 1/);
});

test('referral strips client PII before consent', () => {
  const r = normalizeReferralInput({
    partnerRecordId: 'rec_partner',
    needSummary: 'Necesita automatizar soporte',
    clientConsent: false,
    clientCompany: 'Cliente Secreto',
    clientContact: 'Persona Secreta',
    clientEmail: 'persona@example.com',
    status: 'QUALIFIED'
  });
  assert.equal(r.clientCompany, '');
  assert.equal(r.clientContact, '');
  assert.equal(r.clientEmail, '');
  assert.equal(r.status, 'WAITING_CONSENT');
});

test('referral keeps allowed PII after consent', () => {
  const r = normalizeReferralInput({
    partnerRecordId: 'rec_partner',
    needSummary: 'Necesita automatizar soporte',
    clientConsent: true,
    clientCompany: 'Empresa Demo',
    clientContact: 'Contacto Demo',
    clientEmail: 'Contacto@Example.com'
  });
  assert.equal(r.clientCompany, 'Empresa Demo');
  assert.equal(r.clientEmail, 'contacto@example.com');
});

test('state machine blocks invalid jumps and permits commercial flow', () => {
  assert.equal(assertValidTransition('NEW', 'REVIEW'), true);
  assert.equal(assertValidTransition('PROPOSAL', 'WON'), true);
  assert.throws(() => assertValidTransition('NEW', 'WON'), /Invalid referral transition/);
});

test('WON calculation creates revenue and commission fields', () => {
  assert.deepEqual(buildWonUpdate({ revenueUsd: 5000, commissionRate: 0.15 }), {
    status: 'WON',
    revenueUsd: 5000,
    commissionRate: 0.15,
    commissionUsd: 750
  });
});

test('partner matching favors active capability and market fit', () => {
  const strong = scorePartnerMatch({
    status: 'ACTIVE',
    capabilities: ['Custom Agents','API Integration','Workflow Automation'],
    markets: ['LATAM'],
    languages: ['Spanish'],
    referralMode: 'BIDIRECTIONAL'
  }, { serviceType: 'Custom Agent', market: 'LATAM', language: 'Spanish' });
  const inactive = scorePartnerMatch({ status: 'PAUSED' }, { serviceType: 'Custom Agent' });
  assert.equal(strong, 100);
  assert.equal(inactive, 0);
});

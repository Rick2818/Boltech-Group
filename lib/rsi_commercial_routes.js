import crypto from 'node:crypto';
import pilot from '../config/commercial_pilot.json' with { type: 'json' };

const excluded = /(?:^|[^a-z])(qa|test|sandbox|synthetic)(?:[^a-z]|$)/i;
const stopped = /unsubscribed|opt.?out|do not contact|bounced|hard.?bounce|disqualified/i;
const text = value => typeof value === 'string' ? value.trim() : '';
const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
const url = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };

// Private preparation only. No campaign enrollment, sending, inferred consent or lead-stage changes.
export function buildCommercialRoutes(rsi, leads = []) {
  const seen = new Set(), accounts = [];
  for (const row of leads) {
    const f = row.fields || {};
    if (!/^RSI-0[12](?: US)?$/.test(text(f['Experiment Cohort'])) || f['Data Quality'] === 'QA' ||
        excluded.test(text(f.Name)) || stopped.test([f.Status, f['Commercial Stage'], f['Data Quality']].join(' ')) ||
        f.Unsubscribed === true || f['Do Not Contact'] === true) continue;
    const key = text(f['Contact Email']).toLowerCase() || text(f['Company URL']).toLowerCase() || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const missing = [];
    if (!email(f['Contact Email'])) missing.push('CONTACT_EMAIL');
    if (!text(f['Buyer Role'])) missing.push('BUYER_ROLE');
    if (!url(f['Source Evidence URL'])) missing.push('CONTACT_SOURCE_EVIDENCE');
    const contacted = /\bSENT\b|WAITING_RESPONSE/i.test(text(f.Notes)) || /contacted|waiting.?response/i.test(text(f['Commercial Stage']));
    accounts.push({ sourceRecordId: row.id, account: text(f.Name) || 'Unnamed account', cohort:text(f['Experiment Cohort']),
      route: contacted ? 'REVIEW_EXISTING_THREAD' : missing.length ? 'RESEARCH_CONTACT_GAPS' : 'REVIEW_COHORT_ELIGIBILITY',
      missing, problemConfirmed: f['Problem Confirmed'] === true,
      questions: ['Who owns incoming quotation requests?', 'How are requests registered, assigned and followed up?',
        'What specific delay or missed follow-up needs improvement?', 'What volume and current tools should the pilot cover?'],
      draft: 'Following up on quotation-request tracking: who owns this process, and how do you track each request through a useful response and next step? If there is a specific gap, we can outline a small pilot for you to evaluate.',
      gates: ['LIVE_GMAIL_APOLLO_HISTORY', 'CURRENT_CONTACT_AUTHORIZATION', 'NO_DUPLICATE_ACTIVE_OFFER'],
      enrollmentReady: false });
  }
  // A role's own cohort must not starve behind another role's waiting threads.
  accounts.sort((a,b) => Number(b.cohort === rsi) - Number(a.cohort === rsi) ||
    Number(b.route === 'REVIEW_EXISTING_THREAD') - Number(a.route === 'REVIEW_EXISTING_THREAD') || a.sourceRecordId.localeCompare(b.sourceRecordId));
  const scoped = accounts.slice(0, 5);
  const packet = { version: 1, rsi, mode: 'PRIVATE_PREPARATION', accounts: scoped,
    queue: scoped.length ? 'EXISTING_ACCOUNT_PREPARATION' : 'RESEARCH_COHORT_REQUIRED',
    proposal: rsi === 'RSI-01' ? null : { priceUsd: pilot.implementationAmount, durationDays: pilot.durationDays,
      milestones: pilot.milestones, scope: pilot.scope, toolsUsageAndMaintenanceIncluded: pilot.toolsUsageAndMaintenanceIncluded,
      required: ['CUSTOMER_CONFIRMED_PROBLEM', 'SCOPE_ACCEPTANCE', 'REQUIRED_ACCESS', 'DELIVERY_ACCEPTANCE_CRITERIA', 'DOCUMENTED_COSTS'],
      paymentEnabled: pilot.paymentEnabled, customerAcceptance: 'UNCONFIRMED' },
    nextAction: rsi === 'RSI-01' ? 'Resolve recorded contact gaps and check live history before any authorized outreach.' :
      rsi === 'RSI-02' ? 'Prepare qualification for existing accounts while awaiting accepted audit data; do not duplicate invitations.' :
        'Validate proposal scope and documented costs independently of pending partner approval; no price changes or checkout activation.' };
  return { ...packet, fingerprint: crypto.createHash('sha256').update(JSON.stringify(packet)).digest('hex') };
}

export function mergeCommercialPacket(evidence, packet) {
  const begin = '[RSI_COMMERCIAL_ROUTES_V1]', end = '[/RSI_COMMERCIAL_ROUTES_V1]';
  const original = typeof evidence === 'string' ? evidence : '';
  const start = original.indexOf(begin), finish = original.indexOf(end, start);
  const block = `${begin}\n${JSON.stringify(packet)}\n${end}`;
  if (start >= 0 && finish >= start) return original.slice(0, start) + block + original.slice(finish + end.length);
  return `${original}${original ? '\n\n' : ''}${block}`;
}

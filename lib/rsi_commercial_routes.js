import crypto from 'node:crypto';
import pilot from '../config/commercial_pilot.json' with { type: 'json' };

const excluded = /(?:^|[^a-z])(qa|test|sandbox|synthetic)(?:[^a-z]|$)/i;
const stopped = /unsubscribed|opt.?out|do not contact|bounced|hard.?bounce|disqualified/i;
const text = value => typeof value === 'string' ? value.trim() : '';
const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
const url = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };

export function isCommercialCohort(value) {
  return /^RSI-0[12](?: US)?$/.test(text(value)) || /^RSI01:WEEKDAY_RESEARCH:\d{4}-\d{2}-\d{2}$/.test(text(value));
}
const owner = cohort => cohort.startsWith('RSI01:WEEKDAY_RESEARCH:') ? 'RSI-01' : cohort.replace(/ US$/, '');
const publicSource = f => /RSI01_PUBLIC_QUEUE|RSI_WEEKDAY_SEGMENT_V1/.test(text(f.Notes)) || text(f['Experiment Cohort']).startsWith('RSI01:WEEKDAY_RESEARCH:');
const priority = account => account.route === 'QUALIFY_CUSTOMER_REPLY' ? 0 : account.route === 'REVIEW_COHORT_ELIGIBILITY' ? 1 : account.route === 'RESEARCH_CONTACT_GAPS' ? 2 : 3;

// Private preparation only. No campaign enrollment, sending, inferred consent or lead-stage changes.
export function buildCommercialRoutes(rsi, leads = []) {
  const seen = new Set(), accounts = [];
  for (const row of leads) {
    const f = row.fields || {};
    if (!isCommercialCohort(f['Experiment Cohort']) || f['Data Quality'] === 'QA' ||
        excluded.test(text(f.Name)) || stopped.test([f.Status, f['Commercial Stage'], f['Data Quality']].join(' ')) ||
        f.Unsubscribed === true || f['Do Not Contact'] === true) continue;
    const key = text(f['Contact Email']).toLowerCase() || text(f['Company URL']).toLowerCase() || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const missing = [];
    if (!email(f['Contact Email'])) missing.push('CONTACT_EMAIL');
    // A buyer's role can be learned in the first exchange; it is not a contact prerequisite.
    if (!url(f['Source Evidence URL'])) missing.push('CONTACT_SOURCE_EVIDENCE');
    const contacted = /\bSENT\b|WAITING_RESPONSE/i.test(text(f.Notes)) || /contacted|waiting.?response/i.test(text(f['Commercial Stage']));
    const replied = ['Replied', 'Meeting held', 'Proposal sent', 'Won unpaid'].includes(text(f['Commercial Stage']));
    accounts.push({ sourceRecordId: row.id, account: text(f.Name) || 'Unnamed account', cohort:text(f['Experiment Cohort']),
      route: replied ? 'QUALIFY_CUSTOMER_REPLY' : contacted ? 'REVIEW_EXISTING_THREAD' : missing.length ? 'RESEARCH_CONTACT_GAPS' : 'REVIEW_COHORT_ELIGIBILITY',
      missing, problemConfirmed: f['Problem Confirmed'] === true,
      questions: ['Who owns incoming quotation requests?', 'How are requests registered, assigned and followed up?',
        'What specific delay or missed follow-up needs improvement?', 'What volume and current tools should the pilot cover?'],
      draft: 'Following up on quotation-request tracking: who owns this process, and how do you track each request through a useful response and next step? If there is a specific gap, we can outline a small pilot for you to evaluate.',
      gates: [publicSource(f) ? 'LIVE_GMAIL_HISTORY' : 'LIVE_GMAIL_APOLLO_HISTORY', 'CURRENT_CONTACT_AUTHORIZATION', 'NO_DUPLICATE_ACTIVE_OFFER', 'BUSINESS_RESEARCH_VERIFIED'],
      enrollmentReady: false });
  }
  // A role's own cohort must not starve behind another role's waiting threads.
  accounts.sort((a,b) => Number(owner(b.cohort) === rsi) - Number(owner(a.cohort) === rsi) ||
    priority(a) - priority(b) || a.sourceRecordId.localeCompare(b.sourceRecordId));
  const scoped = accounts.slice(0, 5);
  const packet = { version: 1, rsi, mode: 'PRIVATE_PREPARATION', accounts: scoped,
    sendingImplemented: false,
    queueCounts: { total: accounts.length, selected: scoped.length, pendingContact: accounts.filter(a => ['RESEARCH_CONTACT_GAPS', 'REVIEW_COHORT_ELIGIBILITY'].includes(a.route)).length, awaitingResponse: accounts.filter(a => a.route === 'REVIEW_EXISTING_THREAD').length },
    queue: scoped.length ? 'EXISTING_ACCOUNT_PREPARATION' : 'RESEARCH_COHORT_REQUIRED',
    proposal: rsi === 'RSI-01' ? null : { priceUsd: pilot.implementationAmount, durationDays: pilot.durationDays,
      milestones: pilot.milestones, scope: pilot.scope, toolsUsageAndMaintenanceIncluded: pilot.toolsUsageAndMaintenanceIncluded,
      offerVersion: pilot.offerVersion, outcomes: pilot.outcomes, acceptanceCriteria: pilot.acceptanceCriteria,
      diagnosisRequiresAudit: false,
      required: ['CUSTOMER_CONFIRMED_PROBLEM', 'SCOPE_ACCEPTANCE', 'REQUIRED_ACCESS', 'DELIVERY_ACCEPTANCE_CRITERIA', 'DOCUMENTED_COSTS'],
      paymentEnabled: pilot.paymentEnabled, customerAcceptance: 'UNCONFIRMED' },
    nextAction: rsi === 'RSI-01' ? 'SDR completes business research and live history review, then sends eligible authorized contacts through the verified sending worker. This executor prepares only; if that worker is unavailable, record DISPATCH_WORKER_UNVERIFIED instead of reporting commercial recovery.' :
      rsi === 'RSI-02' ? 'Qualify customer need, current tools, volume, process owner and timing from human responses; prepare an individual proposal when scope and costs are verified. A response-log audit is optional; preserve existing threads.' :
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

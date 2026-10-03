import { paginationGuard } from './store_pagination.js';
const BASE_ID = 'appCQZd0IhBHFoZ9P';
const TABLE_ID = 'tblZaox2MX5uYA5PZ';
const STAGES = [
  'Researching', 'Buyer verified', 'Contacted', 'Replied', 'Meeting held',
  'Proposal sent', 'Won unpaid', 'Paid verified', 'Lost', 'Do not contact'
];

export async function getCommercialCohortMetrics(cohort = 'RSI-01') {
  if (!/^RSI-\d{2,4}$/.test(cohort)) throw new Error('Invalid commercial cohort.');
  const token = String(process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT || '').trim();
  if (!token) throw new Error('AIRTABLE_TOKEN is required for commercial cohort metrics.');

  const stageCounts = Object.fromEntries(STAGES.map(stage => [stage, 0]));
  let total = 0;
  let problemConfirmed = 0;
  let offset;
  const nextPage = paginationGuard();
  do {
    const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(process.env.AIRTABLE_BASE_ID || BASE_ID)}/${TABLE_ID}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('filterByFormula', `{Experiment Cohort}="${cohort}"`);
    url.searchParams.append('fields[]', 'Commercial Stage');
    url.searchParams.append('fields[]', 'Problem Confirmed');
    if (offset) url.searchParams.set('offset', offset);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Airtable commercial metrics HTTP ${response.status}`);
    const page = await response.json();
    offset = nextPage(page);
    for (const record of page.records) {
      const stage = record.fields?.['Commercial Stage'];
      if (!STAGES.includes(stage)) continue;
      stageCounts[stage]++;
      total++;
      if (record.fields?.['Problem Confirmed'] === true) problemConfirmed++;
    }
  } while (offset);

  return { cohort, total, stageCounts, problemConfirmed,
    note: 'CRM stages are entered by operators; they are not provider-confirmed replies or payments.' };
}

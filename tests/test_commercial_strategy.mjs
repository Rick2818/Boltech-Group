import test from 'node:test';
import assert from 'node:assert/strict';
import { COST_PROVIDERS, summarizeCosts, summarizeA2A, decideStrategyActions, getOperatingCostMetrics, buildRsiArchitecture } from '../lib/commercial_strategy.js';
import partnersHandler from '../api/partners.js';

const cost = (Provider, amount = 0) => ({fields: {Provider, Period:'2026-10', Status:'Verified',
  'Amount USD':amount, Evidence:'Invoice checked', 'Verified At':'2026-10-02T18:00:00Z'}});
test('unknown costs remain unknown; verified zero is accepted only with evidence', () => {
  const rows = COST_PROVIDERS.map(p => cost(p));
  assert.equal(summarizeCosts(rows, '2026-10').totalCostUsd, 0);
  delete rows[0].fields['Amount USD'];
  const summary = summarizeCosts(rows, '2026-10');
  assert.equal(summary.totalCostUsd, null);
  assert.deepEqual(summary.missingProviders, ['Vercel']);
});
test('duplicate provider totals and invalid evidence cannot create a false margin', () => {
  const rows = COST_PROVIDERS.map(p => cost(p, 5));
  rows.push(cost('Vercel', 8));
  rows[1].fields.Evidence = '';
  const summary = summarizeCosts(rows, '2026-10');
  assert.equal(summary.totalCostUsd, null);
  assert.deepEqual(summary.duplicateProviders, ['Vercel']);
  assert.equal(summary.verifiedSubtotalUsd, 35);
  assert.equal(summarizeCosts([], '2026-11').totalCostUsd, null);
});
test('not applicable needs evidence and costs reject strings negative and invalid dates', () => {
  const rows = COST_PROVIDERS.map(p => cost(p));
  rows[0].fields.Status = 'Not applicable';
  delete rows[0].fields['Amount USD'];
  assert.equal(summarizeCosts(rows, '2026-10').totalCostUsd, 0);
  rows[1].fields['Amount USD'] = '5';
  rows[2].fields['Amount USD'] = -1;
  rows[3].fields['Verified At'] = 'invalid';
  assert.equal(summarizeCosts(rows, '2026-10').missingProviders.length, 3);
});
test('QA partners and their referrals never appear as genuine acquisition', () => {
  const summary = summarizeA2A([
    {id:'qa', name:'Boltech A2A QA Partner', status:'ACTIVE', a2aEnabled:true},
    {id:'real', name:'Real Partner', status:'ACTIVE', a2aEnabled:true},
    {id:'candidate', name:'Apollo', status:'PROSPECT'}
  ],[
    {partnerRecordIds:['qa'], status:'WON'},
    {partnerRecordIds:['real'], status:'QUALIFIED'},
    {partnerRecordIds:['real'], status:'WON', notes:'QA INTERNO'}
  ]);
  assert.equal(summary.enabledPartners, 1);
  assert.equal(summary.referrals, 1);
  assert.equal(summary.excludedQaReferrals, 2);
  assert.equal(summary.attributedCashUsd, null);
  assert.doesNotMatch(JSON.stringify(summary), /Real Partner/);
});
test('all three strategies have actionable decisions without pretending missing data is zero', () => {
  const actions = decideStrategyActions();
  assert.equal(actions.length, 4);
  assert.equal(actions[1].observedAccounts, null);
  assert.equal(actions[3].totalCostUsd, null);
  assert.match(actions[2].action, /Restablecer/);
});
test('cost pagination uses Salvador month and emits no evidence or credentials', async () => {
  const originalFetch = globalThis.fetch, token = process.env.AIRTABLE_TOKEN;
  process.env.AIRTABLE_TOKEN = 'private-test-token';
  const pages = [{records:[cost('Vercel',10)], offset:'next'}, {records:COST_PROVIDERS.slice(1).map(p=>cost(p))}];
  globalThis.fetch = async url => {
    assert.equal(new URL(url).searchParams.get('filterByFormula'), '{Period}="2026-10"');
    return {ok:true, json:async()=>pages.shift()};
  };
  try {
    const summary = await getOperatingCostMetrics(new Date('2026-11-01T02:00:00Z'));
    assert.equal(summary.totalCostUsd, 10);
    assert.doesNotMatch(JSON.stringify(summary), /Invoice|private-test-token/);
  } finally {
    globalThis.fetch = originalFetch;
    if(token === undefined) delete process.env.AIRTABLE_TOKEN; else process.env.AIRTABLE_TOKEN = token;
  }
});
test('authenticated aggregate preserves payments when cost/cohort dependencies fail', async () => {
  const originalFetch = globalThis.fetch, token = process.env.AIRTABLE_TOKEN, auth = process.env.PARTNER_API_TOKEN;
  process.env.AIRTABLE_TOKEN = 'test'; process.env.PARTNER_API_TOKEN = 'secret';
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    if(parsed.pathname.includes('tblpPzMSjM1EVpF8Y') || parsed.searchParams.get('filterByFormula')?.includes('RSI-02'))
      return {ok:false, status:403};
    const fields = parsed.pathname.includes('tbl7j8UvfuOAkbgRB') ? {
      Status:'PAID', Environment:'production', 'Expected Amount USD':49,
      'Provider Transaction ID':'tx', 'Provider Evidence':'confirmed', 'Paid At':'2026-10-02T00:00:00Z'
    } : null;
    const data = {records:fields ? [{fields}] : []};
    return {ok:true, json:async()=>data, text:async()=>JSON.stringify(data)};
  };
  let status, payload;
  const res = {setHeader(){}, status(n){status=n;return this;},json(p){payload=p;return this;}};
  try {
    await partnersHandler({method:'GET',url:'/api/partners?action=commercial-metrics',headers:{host:'localhost',authorization:'Bearer secret'}},res);
    assert.equal(status,200);
    assert.equal(payload.metrics.verifiedSales.cashCollectedUsd,49);
    assert.equal(payload.metrics.cohorts['RSI-02'],null);
    assert.equal(payload.metrics.operatingCosts,null);
    assert.equal(payload.metrics.componentStatus.costs,'unavailable');
    assert.equal(payload.metrics.a2a.referrals,0);
  } finally {
    globalThis.fetch=originalFetch;
    for(const [key,value] of [['AIRTABLE_TOKEN',token],['PARTNER_API_TOKEN',auth]])
      if(value===undefined) delete process.env[key]; else process.env[key]=value;
  }
});


test('coordinator links three RSI through evidence gates and never provisions dots', () => {
  const flow = buildRsiArchitecture({metrics:{verifiedSales:{cashCollectedUsd:0},a2a:{enabledPartners:0},operatingCosts:{complete:false}},
    campaign:{status:'verified',id:'main'},auditCampaign:{status:'verified',active:false,id:'audit'}});
  assert.equal(flow.controllers.length,3);
  assert.equal(flow.controllers[1].state,'DRAFT_REVIEW');
  assert.equal(flow.controllers[2].state,'WAITING_COST_EVIDENCE');
  assert.equal(flow.handoffs[0].from,'RSI-01');
  assert.equal(flow.handoffs[0].to,'RSI-02');
  assert.equal(flow.mode,'OBSERVE_DECIDE_REPORT');
  assert.match(flow.dotProvisioning,/NOT_CONFIGURED/);
  assert.equal(buildRsiArchitecture().controllers.every(c=>c.state==='WAITING_DATA'),true);
});

test('collection goal preserves unavailable payment data and distinguishes verified zero from repeat collection', () => {
  for (const cash of [undefined, null, NaN, Infinity, '0', '49']) {
    const flow = buildRsiArchitecture({metrics:{verifiedSales:{cashCollectedUsd:cash}}});
    assert.equal(flow.goal,'WAITING_VERIFIED_CASH');
    assert.equal(flow.observation.cashCollectedUsd,null);
  }
  assert.equal(buildRsiArchitecture().goal,'WAITING_VERIFIED_CASH');
  assert.equal(buildRsiArchitecture({metrics:{verifiedSales:{cashCollectedUsd:0}}}).goal,'FIRST_VERIFIED_COLLECTION');
  assert.equal(buildRsiArchitecture({metrics:{verifiedSales:{cashCollectedUsd:49}}}).goal,'REPEAT_PROFITABLE_COLLECTION');
});

test('audit campaign remains waiting until activation state is verified', () => {
  for (const active of [undefined, null, 'false']) {
    assert.equal(buildRsiArchitecture({auditCampaign:{status:'verified',active}}).controllers[1].state,'WAITING_DATA');
  }
  assert.equal(buildRsiArchitecture({auditCampaign:{status:'verified',active:false}}).controllers[1].state,'DRAFT_REVIEW');
  assert.equal(buildRsiArchitecture({auditCampaign:{status:'verified',active:true}}).controllers[1].state,'MEASURED');
});

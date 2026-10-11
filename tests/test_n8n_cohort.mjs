import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCommercialRoutes, isCommercialCohort} from '../lib/rsi_commercial_routes.js';

const source = 'N8N_FREELANCE_2026-10-10';
const mk = (id, name, stage='Contacted', quality='RESEARCH_ONLY') => ({
  id, fields: { Name:name, 'Experiment Cohort':source, 'Contact Email':id+'@example.org',
    'Source Evidence URL':'https://community.n8n.io/t/example/1',
    'Commercial Stage':stage, 'Data Quality':quality,
    Notes:'Gmail SENT confirmed; awaiting customer reply', 'Problem Confirmed':false }
});

test('n8n dated outreach cohort is selected for RSI-01 but not treated as dispatched automatically',()=>{
  assert.equal(isCommercialCohort(source),true);
  assert.equal(isCommercialCohort('N8N_FREELANCE_UNKNOWN'),false);
  const input=['LeadFlow AI','KB DIGITAL','Raj AI Automation','Yusuf Maged','ZVEPOW']
    .map((name,i)=>mk('lead'+i,name));
  const result=buildCommercialRoutes('RSI-01',input);
  assert.equal(result.accounts.length,5);
  assert.equal(result.queueCounts.awaitingResponse,5);
  assert.ok(result.accounts.every(x=>x.route==='REVIEW_EXISTING_THREAD'));
  assert.equal(result.mode,'PRIVATE_PREPARATION');
  assert.equal(result.sendingImplemented,false);
  assert.ok(result.accounts.every(x=>x.enrollmentReady===false));
});

test('Cliente Sintético is excluded even if quality is misclassified; QA also excluded',()=>{
  const result=buildCommercialRoutes('RSI-01',[
    mk('fake','Cliente Sintético','Contacted','RESEARCH_ONLY'),
    mk('fake2','CLIENTE SINTETICO','Contacted','RESEARCH_ONLY'),
    mk('qa','Ordinary Name','Contacted','QA'),
    mk('real','Verified Business')
  ]);
  assert.deepEqual(result.accounts.map(x=>x.account),['Verified Business']);
});

test('n8n records with a reply route to qualification but never presume payment',()=>{
  const p=buildCommercialRoutes('RSI-01',[mk('responded','Buyer','Replied')]);
  assert.equal(p.accounts[0].route,'QUALIFY_CUSTOMER_REPLY');
  assert.equal(p.proposal,null);
  assert.equal(p.sendingImplemented,false);
});

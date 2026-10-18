import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessLead, selectFiveLeads } from '../scripts/commercial/agent1_lead_gate.mjs';

const qaCase = JSON.parse(readFileSync('config/qa_case.json', 'utf8'));
const qaLead = {
  leadId: qaCase.id,
  company: '',
  name: '',
  title: '',
  domain: '',
  businessNeed: qaCase.answers[1],
  contactEmail: qaCase.answers[8],
  emailValidation: { mailboxConfirmed: false },
  buyerVerified: false,
  needVerified: false,
  sourceVerified: false,
  synthetic: true
};

test('the only QA case is rejected as a commercial buyer', () => {
  const result = assessLead(qaLead);
  assert.equal(result.eligible, false);
  assert.ok(result.problems.includes('SYNTHETIC_NOT_ALLOWED'));
  assert.ok(result.problems.includes('BUYER_UNVERIFIED'));
});

test('QA mode does not convert the QA case into a verified buyer', () => {
  const result = assessLead(qaLead, { qaMode: true });
  assert.equal(result.eligible, false);
  assert.ok(result.problems.includes('NEED_UNVERIFIED'));
});

test('the single QA case cannot fill a five-buyer cohort', () => {
  const result = selectFiveLeads([qaLead], [], { qaMode: true });
  assert.equal(result.complete, false);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.missing, 5);
});

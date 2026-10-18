import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyN8nJobTopic } from '../scripts/commercial/agent1_n8n_community_jobs.mjs';

const qaCase = JSON.parse(readFileSync('config/qa_case.json', 'utf8'));

test('the sole QA case cannot become a freelance opportunity', () => {
  const topic = { id: qaCase.id, title: qaCase.answers[7], excerpt: qaCase.purpose, slug: 'qa-case' };
  assert.equal(classifyN8nJobTopic(topic, { qaCaseId: qaCase.id }), null);
});

test('unknown non-job QA material is not promoted to an opportunity', () => {
  const topic = { id: qaCase.id, title: qaCase.answers[0], excerpt: qaCase.answers[1], slug: 'qa-case' };
  assert.equal(classifyN8nJobTopic(topic, { qaCaseId: qaCase.id }), null);
});

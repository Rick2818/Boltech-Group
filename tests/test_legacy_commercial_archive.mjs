import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('current Agent 1 and review cannot depend on retired Airtable dispatch',()=>{
 const paths=['lib/agent1_continuous_cycle.js','lib/agent1_company_draft_review.js','lib/agent1_continuous_research.js'];
 for(const p of paths){
  const text=read(p);
  assert.doesNotMatch(text,/\bAIRTABLE_TOKEN\b|airtableRecordId|from ['"]\.\/sdr_dispatch\.js['"]|from ['"]\.\/sdr_campaign\.js['"]/i,p);
 }
});
test('legacy source remains preserved in archive for audit only',()=>{
 for(const p of ['sdr_dispatch.js','sdr_campaign.js'])assert.match(read('archive/commercial-legacy-2026/lib/'+p),/ARCHIVED 2026-10-21/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {audit} from '../scripts/quality/audit_legacy_commercial_dependencies.mjs';

test('active Supabase Agent 1 and Marketing runtime never import legacy Airtable executors',()=>{
 const result=audit();
 assert.ok(result.canonical.includes('lib/agent1_continuous_cycle.js'));
 assert.ok(result.canonical.includes('lib/agent1_company_draft_review.js'));
 for(const edge of result.productionLegacyEdges){
  assert.ok(!result.canonical.includes(edge.source),'legacy import into canonical '+edge.source+' -> '+edge.target);
 }
});
test('legacy API and scheduled workflows are inventoried, not silently treated as archived',()=>{
 const result=audit();
 assert.ok(Array.isArray(result.productionLegacyEdges));
 assert.ok(Array.isArray(result.airtableReferences));
 assert.ok(Array.isArray(result.scheduledWorkflowFiles));
});

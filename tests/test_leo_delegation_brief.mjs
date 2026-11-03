import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeoTenantAgent} from '../lib/leo_tenant_autonomy.js';

function harness() {
  const records = new Map();
  const store = {
    read: async key => structuredClone(records.get(key) ?? null),
    writeIfVersion: async (key, version, value) => {
      if ((records.get(key)?.version ?? null) !== version) return false;
      records.set(key, structuredClone(value));
      return true;
    }
  };
  const agent = (tenantId, subject='owner-001', roles=['tenant_admin']) =>
    createLeoTenantAgent({store, principal:{verified:true,tenantId,subject,roles}});
  return {agent};
}

const objective = {
  id: 'customer-delegation-001',
  description: 'Analyze the customer service backlog without contacting customers',
  criteria: 'Produce a reviewed summary of the evidence',
  delegation: {
    expectedResult: 'A brief with sources, risks and proposed next actions',
    sources: ['Customer-approved CRM export', 'Customer support FAQs'],
    reviewInstructions: 'Request review before any action that changes data',
    preferredChannel: 'voice'
  }
};

test('a Dots-like brief persists without claiming a connected Dot or scheduler', async () => {
  const {agent} = harness();
  const leo = agent('tenant-001');
  const created = await leo.objective(objective);
  assert.equal(created.delegation.expectedResult, objective.delegation.expectedResult);
  assert.deepEqual(created.delegation.sources, objective.delegation.sources);
  assert.equal(created.delegation.scheduleStatus, 'NOT_CONFIGURED');
  assert.equal(created.delegation.notificationStatus, 'NOT_CONFIGURED');
  assert.equal(created.delegation.sourceStatus, 'REFERENCES_ONLY');
  assert.equal(created.delegation.executionPolicy, 'READ_ONLY_WITH_EXPLICIT_APPROVAL');
  assert.equal(created.status, 'AWAITING_PLAN_APPROVAL');
  const reopened = agent('tenant-001');
  const progress = await reopened.progress(objective.id);
  assert.equal(progress.version, created.version);
  assert.equal(progress.plannedSteps, 0);
  assert.equal(progress.lastReceipt, null);
  assert.equal(progress.recentActivity[0].kind, 'CREATED');
  const same = await reopened.objective(objective);
  assert.equal(same.version, created.version);
  await assert.rejects(
    reopened.objective({...objective,delegation:{...objective.delegation,expectedResult:'Different requested result'}}),
    {code:'LEO_OBJECTIVE_CONFLICT'}
  );
});

test('brief metadata never authorizes dispatch, cross-tenant reads, or unsupported scheduling', async () => {
  const {agent} = harness();
  const leo = agent('tenant-001');
  await leo.objective(objective);
  assert.equal(await agent('tenant-002').progress(objective.id), null);
  await assert.rejects(agent('tenant-001','other-002',['tenant_operator']).progress(objective.id), {code:'LEO_ACCESS_DENIED'});
  await assert.rejects(leo.transition({
    id:objective.id,expectedVersion:1,action:'execute',
    eventId:'execute-001',approval:true,toolName:'email_send'
  }), {code:'LEO_EXECUTION_NOT_AUTHORIZED'});
  await assert.rejects(leo.objective({
    ...objective,id:'customer-delegation-002',
    delegation:{...objective.delegation,cadence:'every-hour'}
  }), {code:'LEO_DELEGATION_FIELD_UNSUPPORTED'});
  await assert.rejects(leo.objective({
    ...objective,id:'customer-delegation-003',
    delegation:{...objective.delegation,preferredChannel:'telephone_call'}
  }), {code:'LEO_DELEGATION_CHANNEL_INVALID'});
});

test('legacy objectives stay readable without a delegation brief', async () => {
  const {agent} = harness();
  const leo=agent('tenant-001');
  const created=await leo.objective({
    id:'legacy-objective-001',
    description:'Inspect an existing public record',
    criteria:'Return a verified source receipt'
  });
  assert.equal(created.delegation, undefined);
  const status=await leo.progress(created.id);
  assert.equal(status.delegation,null);
  assert.equal(status.status,'AWAITING_PLAN_APPROVAL');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeoTenantAgent} from '../lib/leo_tenant_autonomy.js';

// Regression gate: no external tool may execute before an exclusive durable claim.
// The current implementation executes before its CAS write; this test must fail
// until execution uses a durable, resumable claim and idempotent receipt protocol.
test('Leo concurrent execution dispatches an approved tool at most once', async () => {
  const data = new Map();
  const store = {
    read: async k => structuredClone(data.get(k) ?? null),
    writeIfVersion: async (k, version, next) => {
      const old = data.get(k);
      if ((old?.version ?? null) !== version) return false;
      data.set(k, structuredClone(next));
      return true;
    }
  };
  let calls = 0;
  const principal = {verified:true,tenantId:'tenant-leo',subject:'owner-leo',roles:['tenant_admin']};
  const tools = {research:{readOnly:true,run:async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return {ok:true,receipt:'read-only-receipt'};
  }}};
  const agent = createLeoTenantAgent({store,principal,tools});
  let r = await agent.objective({id:'goal-001',description:'Research the lead requirements',criteria:'Produce a verified research receipt'});
  r = await agent.transition({id:r.id,expectedVersion:r.version,action:'plan',eventId:'plan-001',plan:['Review the lead requirements']});
  r = await agent.transition({id:r.id,expectedVersion:r.version,action:'approve',eventId:'approve-001',approval:true});
  await Promise.allSettled([
    agent.transition({id:r.id,expectedVersion:r.version,action:'execute',eventId:'execute-001',toolName:'research',approval:true}),
    agent.transition({id:r.id,expectedVersion:r.version,action:'execute',eventId:'execute-002',toolName:'research',approval:true})
  ]);
  assert.equal(calls,1,'concurrent attempts must not dispatch the same tool twice');
});

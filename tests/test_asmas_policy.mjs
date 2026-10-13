import test from 'node:test';import assert from 'node:assert/strict';
import {AGENT_DEFINITIONS,authorize} from '../asmas/agent-definitions.mjs';
import {validateEnvelope,safeRetry} from '../asmas/redis-adapter.mjs';
import {mayInvoke} from '../asmas/mcp-policy.mjs';
test('five role definitions with bounded tools',()=>{assert.equal(Object.keys(AGENT_DEFINITIONS).length,5);for(const a of Object.values(AGENT_DEFINITIONS))assert.ok(a.skills.length>0)});
test('least privilege and production restrictions',()=>{assert.equal(mayInvoke({agent:'A1',platform:'github',operation:'read_repos'}),false);assert.equal(mayInvoke({agent:'A4',platform:'github',operation:'read_repos'}),true);assert.equal(mayInvoke({agent:'A3',platform:'payments',operation:'create_payment',environment:'production'}),false);assert.equal(authorize('A5','deploy'),false)});
test('safe reattempt and valid queue',()=>{assert.equal(safeRetry({kind:'TIMEOUT',attempts:1}),true);assert.equal(safeRetry({kind:'SEND_UNKNOWN',attempts:1}),false);assert.equal(validateEnvelope({schema_version:1,message_id:'m',source_agent:'A1',destination_agent:'A2',task_id:'t',idempotency_key:'key'}),'asmas:agent_2_queue')});

import test from 'node:test';
import assert from 'node:assert/strict';
import {agent1RecursiveImprovement} from '../lib/agent1_v2_recursive_improvement.js';
import {createAgent1V2} from '../lib/agent1_v2_executor.js';
test('self improvement remains isolated to Agent 1',()=>{
 assert.throws(()=>agent1RecursiveImprovement({agent:'MARKETING',observations:[{issueCode:'SOURCE_UNAVAILABLE',count:1}]}),/SCOPE_VIOLATION/);
});
test('recursion proposes bounded QA plans, cannot deploy or send',()=>{
 const r=agent1RecursiveImprovement({observations:[{issueCode:'LOW_VERIFIED_LEAD_YIELD',count:4},{issueCode:'SOURCE_UNAVAILABLE',count:1}]});
 assert.equal(r.proposals.length,2);
 assert.equal(r.codeModified,false);
 assert.equal(r.deploymentChanged,false);
 assert.equal(r.outboundSent,false);
 assert.equal(r.proposals[0].requiresHumanApproval,true);
 assert.equal(r.proposals[1].autoSend,false);
});
test('repeat findings, arbitrary commands and invalid counts are rejected',()=>{
 const r=agent1RecursiveImprovement({observations:[{issueCode:'SOURCE_UNAVAILABLE',count:1},{issueCode:'SOURCE_UNAVAILABLE',count:3},{issueCode:'DELETE_DATABASE',count:1},{issueCode:'DUPLICATE_RATE_HIGH',count:0}],priorAttempts:[{issueCode:'SOURCE_UNAVAILABLE'}]});
 assert.equal(r.proposals.length,0);
});
test('bound to Agent 1 unified executor',()=>{
 const a=createAgent1V2({redisCommand:async()=>null,mailSender:{send:async()=>{throw Error('NO_SEND');}},crm:{recordEvent:async()=>{}}});
 assert.equal(a.recursiveSelfImprovement({observations:[{issueCode:'CRM_SYNC_DELAY',count:2}]}).proposals[0].action,'RECONCILE_CRM_RECEIPTS');
});

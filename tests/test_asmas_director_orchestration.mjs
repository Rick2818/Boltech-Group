import test from 'node:test';
import assert from 'node:assert/strict';
import {directorPlan,validateDirectorHandoff} from '../asmas/director-orchestration.mjs';
const runId='4203cbf7-d558-466a-825a-04085b43319f';
test('A4 assigns A1 A2 A3 with explicit dependencies and zero external authorization',()=>{
 const plan=directorPlan({runId,marketAnalysis:'Synthetic A5 analysis'});
 assert.deepEqual(plan.assignments.map(a=>a.agent),['A1','A2','A3']);
 assert.deepEqual(plan.assignments.map(a=>a.depends_on),['A5','A1','A2']);
 assert.equal(plan.approved,false);assert.equal(plan.external_actions_allowed,false);
 assert.equal(validateDirectorHandoff(plan,{destination:'A1',completedAgents:['A5']}).destination_agent,'A1');
 assert.throws(()=>validateDirectorHandoff(plan,{destination:'A2',completedAgents:['A5']}),/DEPENDENCY/);
 assert.equal(validateDirectorHandoff(plan,{destination:'A2',completedAgents:['A5','A1']}).director,'A4');
 assert.equal(validateDirectorHandoff(plan,{destination:'A3',completedAgents:['A5','A1','A2']}).destination_agent,'A3');
});
test('A4 policy rejects live flows, absent analysis, unknown routes and forged approvals',()=>{
 assert.throws(()=>directorPlan({runId,marketAnalysis:'ok',mode:'LIVE'}),/SYNTHETIC_ONLY/);
 assert.throws(()=>directorPlan({runId,marketAnalysis:''}),/ANALYSIS_REQUIRED/);
 const plan=directorPlan({runId,marketAnalysis:'ok'});
 assert.throws(()=>validateDirectorHandoff(plan,{destination:'A5',completedAgents:['A4']}),/ROUTE_INVALID/);
 assert.throws(()=>validateDirectorHandoff({...plan,external_actions_allowed:true},{destination:'A1',completedAgents:['A5']}),/POLICY_INVALID/);
});

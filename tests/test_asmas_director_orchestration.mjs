import test from 'node:test';
import assert from 'node:assert/strict';
import {directorPlan,validateDirectorHandoff,directorNextTask,directorDispatch} from '../asmas/director-orchestration.mjs';
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

test('A4 builds queue-ready instructions for A1 A2 A3 in dependency order without side effects',()=>{
 const plan=directorPlan({runId,marketAnalysis:'Synthetic qualification'});
 const a1=directorNextTask({plan,completedAgents:['A5'],outputs:{A5:'market analysis'}});
 assert.equal(a1.agent,'A1');
 assert.equal(a1.idempotency_key,runId+':A1');
 assert.equal(a1.payload.orchestration.director,'A4');
 assert.equal(a1.payload.orchestration.previous_output,'market analysis');
 assert.equal(a1.payload.orchestration.external_actions_allowed,false);
 assert.throws(()=>directorNextTask({plan,completedAgents:['A5','A1']}),/PREVIOUS_OUTPUT_REQUIRED/);
 const a2=directorNextTask({plan,completedAgents:['A5','A1'],outputs:{A1:'validated synthetic lead'}});
 assert.equal(a2.agent,'A2');
 assert.equal(a2.payload.orchestration.previous_output,'validated synthetic lead');
 const a3=directorNextTask({plan,completedAgents:['A5','A1','A2'],outputs:{A2:'draft quote'}});
 assert.equal(a3.agent,'A3');
 assert.equal(a3.payload.orchestration.previous_output,'draft quote');
 assert.equal(directorNextTask({plan,completedAgents:['A5','A1','A2','A3']}),null);
});

test('A4 adapter records durable queue assignment and deduplicates the same synthetic task',async()=>{
 const plan=directorPlan({runId,marketAnalysis:'fixture'});
 const seen=new Set(),decisions=[];
 const repository={enqueue:async task=>{if(seen.has(task.idempotency_key))return false;seen.add(task.idempotency_key);return true;},
  recordDecision:async decision=>{decisions.push(decision)}};
 const args={plan,completedAgents:['A5'],outputs:{A5:'safe market data'},repository};
 const one=await directorDispatch(args),again=await directorDispatch(args);
 assert.equal(one.status,'ASSIGNED');assert.equal(one.enqueued,1);
 assert.equal(again.status,'ALREADY_ASSIGNED');assert.equal(again.enqueued,0);
 assert.equal(seen.size,1);assert.equal(decisions.length,2);
 assert.ok(decisions.every(x=>x.director==='A4'&&x.external_actions_allowed===false));
 await assert.rejects(directorDispatch({...args,repository:{enqueue:async()=>true}}),/DURABLE_REPOSITORY_REQUIRED/);
});

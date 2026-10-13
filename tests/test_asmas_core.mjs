import test from 'node:test';
import assert from 'node:assert/strict';
import {runSynthetic} from '../asmas/runner.mjs';
import {AGENTS,CaseLedger,message} from '../asmas/core.mjs';
test('one synthetic lead traverses all five agents; no real revenue',()=>{
 const {ledger,handoffs,report}=runSynthetic({runId:'run-1'});
 assert.equal(report.case_id,'SYN-E2E-001');assert.equal(report.is_synthetic,true);
 assert.equal(report.stage,'CLOSED_WON');assert.equal(report.revenue_real,0);
 assert.deepEqual(handoffs.map(m=>m.source_agent+'>'+m.destination_agent),['A5>A1','A1>A2','A2>A3','A3>A4']);
 assert.equal(ledger.events.filter(e=>e.kind==='HANDOFF').length,4);
});
test('20 A2A directions supported',()=>{
 for(const a of AGENTS)for(const b of AGENTS)if(a!==b)assert.equal(message({source:a,destination:b,action:'PING',caseId:'SYN-E2E-001',runId:'r'}).destination_agent,b);
});
test('message and transition idempotency',()=>{
 const l=new CaseLedger();
 const m=message({source:'A1',destination:'A2',action:'TRANSFER',caseId:l.caseId,runId:'r',taskId:'same'});
 assert.equal(l.deliver(m),true);assert.equal(l.deliver(m),false);
 assert.equal(l.transit('RESEARCHING',{key:'stage1',agent:'A1'}),true);
 assert.equal(l.transit('RESEARCHING',{key:'stage1',agent:'A1'}),false);
});
test('invalid route, illegal transition and unverified real payment rejected',()=>{
 assert.throws(()=>message({source:'A1',destination:'A1',action:'X',caseId:'SYN',runId:'r'}));
 const l=new CaseLedger({synthetic:false});
 assert.throws(()=>l.transit('CLOSED_WON',{key:'bad',agent:'A3'}));
 for(const [stage,agent] of [['RESEARCHING','A1'],['QUALIFIED','A1'],['PROPOSAL_PREPARING','A2'],['PROPOSAL_SENT','A2'],['NEGOTIATION','A3'],['ACCEPTED','A3'],['PAYMENT_PENDING','A3']])l.transit(stage,{key:stage,agent});
 assert.throws(()=>l.transit('PAYMENT_CONFIRMED',{key:'pay',agent:'A3'}),/PAYMENT_EVIDENCE_REQUIRED/);
});
test('independent runs do not create extra client fixture',()=>{
 const a=runSynthetic({runId:'a'}),b=runSynthetic({runId:'b'});
 assert.equal(a.report.case_id,b.report.case_id);assert.notEqual(a.runId,b.runId);
});

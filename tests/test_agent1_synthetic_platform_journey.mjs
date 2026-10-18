import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLead,selectFiveLeads} from '../scripts/commercial/agent1_lead_gate.mjs';
const platforms=['APOLLO','LUSHA','UPWORK','N8N','INTERNET'];
const mock=(source,i)=>({leadId:'QA-'+source+'-'+i,source,company:'Synthetic '+source+' '+i,name:'Synthetic Buyer '+i,title:'Operations Director',domain:'example.test',contactEmail:source.toLowerCase()+i+'@example.test',businessNeed:'Automate manual quotation response',emailValidation:{mailboxConfirmed:true},buyerVerified:true,needVerified:true,sourceVerified:true,synthetic:true});
test('each source can reach the same quality gate with synthetic verified evidence',()=>{
 const candidates=platforms.map((source,i)=>mock(source,i));
 const result=selectFiveLeads(candidates,[],{qaMode:true});
 assert.equal(result.complete,true);assert.equal(result.accepted.length,5);
 assert.equal(result.nextAction,'SIMULATED_HANDOFF_AGENT_2');
 assert.deepEqual(result.accepted.map(x=>x.source),platforms);
 // This is a routing decision, NOT an actual transport or CRM handoff.
});
test('unknown Marsyrand gets replaced without reducing five accepted records',()=>{
 const candidates=[mock('APOLLO',0),{leadId:'QA-UNKNOWN',company:'Marsyrand'},...platforms.slice(1).map((p,i)=>mock(p,i+1))];
 const r=selectFiveLeads(candidates,[],{qaMode:true});
 assert.equal(r.rejected.length,1);assert.equal(r.accepted.length,5);assert.equal(r.complete,true);
});
test('missing source evidence blocks handoff and requests replacement',()=>{
 const r=selectFiveLeads(platforms.map((p,i)=>i===2?{...mock(p,i),sourceVerified:false}:mock(p,i)),[],{qaMode:true});
 assert.equal(r.complete,false);assert.equal(r.nextAction,'RESEARCH_REPLACEMENTS');
});
test('synthetic fixtures must not be treated as actual customers',()=>{
 for(const s of platforms){assert.equal(mock(s,0).synthetic,true);assert.ok(mock(s,0).contactEmail.endsWith('@example.test'));}
});

test('production rejects all synthetic candidates regardless of apparent evidence',()=>{const r=selectFiveLeads(platforms.map((p,i)=>mock(p,i)));assert.equal(r.accepted.length,0);assert.equal(r.missing,5);assert.ok(r.rejected.every(x=>x.problems.includes('SYNTHETIC_NOT_ALLOWED')));});

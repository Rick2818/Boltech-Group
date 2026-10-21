import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgent1LeadSources,fromApolloContacts,fromUpworkJobs,fromExpleeExport} from '../lib/agent1_v2_lead_sources.js';
import {createAgent1V2} from '../lib/agent1_v2_executor.js';
test('Apollo saved contact imports but never authorizes email',()=>{
 const rows=fromApolloContacts({contacts:[{id:'1',organization_name:'Example',email:'info@example.com',email_status:'verified'}]});
 assert.equal(rows.length,1);assert.equal(rows[0].buyerVerified,false);
});
test('Upwork listings use in-platform contact not invented mailbox',()=>{
 const jobs=fromUpworkJobs({jobs:[{id:'123',title:'Workflow automation',client:{country:'United States'}}]});
 assert.equal(jobs[0].email,'');assert.equal(jobs[0].buyerVerified,false);
});
test('Explee exports remain unverified and fail closed without dataset',()=>{
 assert.equal(fromExpleeExport([{id:'x',company:'Example',email:'info@example.com'}])[0].contactVerified,false);
 assert.throws(()=>fromExpleeExport(null),/EXPLEE_EXPORT_REQUIRED/);
});
test('all sources available from single agent and no automatic sends',async()=>{
 const agent=createAgent1V2({redisCommand:async()=>null,mailSender:{send:async()=>{throw Error('SHOULD_NOT_SEND');}},crm:{recordEvent:async()=>{}}});
 const source=agent.leadSources({apollo:async()=>[{id:'1',email:'info@example.com'}],upwork:async()=>[{id:'2',title:'automation'}]});
 const r=await source.discover();
 assert.ok(r.observed>2);assert.equal(r.sources[2].status,'OBSERVED');
 assert.ok(r.sources[2].candidates.length>0);
 assert.equal(r.sources[2].candidates[0].sendAllowed,false);
 assert.equal(r.sources[0].candidates[0].sendAllowed,false);
 assert.equal(r.sendAllowed,false);
});

test('historical Explee source cannot auto-qualify contacts',async()=>{ const source=createAgent1LeadSources(); const result=await source.discover(); assert.equal(result.sources[2].status,'OBSERVED');assert.ok(result.sources[2].candidates.length>0);assert.equal(result.sources[2].candidates[0].contactVerified,false);assert.equal(result.sources[2].candidates[0].buyerVerified,false); });

test('Explee historic source retains country for commercial triage',async()=>{const {triageAgent1Candidates}=await import('../lib/agent1_v2_triage.js');const result=await createAgent1LeadSources().discover();const explee=result.sources.find(s=>s.source==='EXPLEE');assert.ok(explee.candidates.some(x=>x.country));const summary=triageAgent1Candidates(result.sources);assert.ok(summary.diagnostics.EXPLEE.observed>0);assert.equal(summary.selected.length,0);assert.equal(summary.ready,false);});

test('research accepts over 50 candidates; all remain send-disabled',async()=>{
 const {createAgent1LeadSources}=await import('../lib/agent1_v2_lead_sources.js');
 const rows=Array.from({length:125},(_,i)=>({id:String(i),company:'US Company '+i,email:'contact'+i+'@example.org',country:'US'}));
 const result=await createAgent1LeadSources({apollo:async()=>rows,upwork:async()=>[],explee:async()=>[]}).discover();
 assert.equal(result.observed,125);
 assert.equal(result.sources[0].candidates.length,125);
 assert.equal(result.sendAllowed,false);
 assert.ok(result.sources[0].candidates.every(x=>x.sendAllowed===false));
});

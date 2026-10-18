import test from 'node:test';import assert from 'node:assert/strict';
import {createLeadPreparation} from '../lib/rsi01_lead_preparation.js';
function fixture(count=7){
 const kv=new Map(),leads=Array.from({length:count},(_,i)=>({id:'recLead'+i,fields:{Name:'Business '+i,'Company URL':`https://company${i}.com`,'Contact Email':`sales@company${i}.com`}}));let investigations=0;
 const command=async a=>{if(a[0]==='GET')return kv.get(a[1])??null;if(a[0]==='SET'){if(a.includes('NX')&&kv.has(a[1]))return null;kv.set(a[1],a[2]);return 'OK';}if(a[0]==='EVAL'){if(a[2]===2){if(kv.get(a[3])!==a[5])return 'LEASE_LOST';kv.set(a[4],a[6]);return 'OK';}if(kv.get(a[3])===a[4])kv.delete(a[3]);return 1;}throw Error('unexpected');};
 const options={command,listLeads:async()=>structuredClone(leads),readLead:async id=>structuredClone(leads.find(l=>l.id===id)),writeLead:async(id,fields)=>Object.assign(leads.find(l=>l.id===id).fields,fields),investigate:async lead=>{investigations++;return {state:'PUBLIC_WEBSITE_OBSERVED',operationalSignals:[{type:'QUOTE_INTAKE',sourceUrl:lead.fields['Company URL']}],contactEvidence:[{email:lead.fields['Contact Email'],url:lead.fields['Company URL'],basis:'OFFICIAL_PUBLICATION'}]};},validateEmail:async()=>({mx:true}),gmail:{verify:async()=>({verified:true}),search:async()=>[]},apollo:async()=>({complete:true,contacts:[]}),now:()=> '2026-10-18T14:30:00Z'};
 return {options,leads,kv,worker:createLeadPreparation(options),count:()=>investigations};
}
test('stops at exactly five complete distinct companies; fresh instance reuses ledger',async()=>{const f=fixture();for(let i=0;i<5;i++)await f.worker.run();const s=await f.worker.status();assert.equal(s.state,'READY');assert.equal(s.selected.length,5);const n=f.count();assert.equal((await createLeadPreparation(f.options).run()).reused,true);assert.equal(f.count(),n);assert.equal(new Set(s.selected.map(l=>l.domain)).size,5);const packet=JSON.parse(f.leads[0].fields.Notes.match(/\[SDR_CANDIDATE_V1\](.*?)\[\/SDR_CANDIDATE_V1\]/s)[1]);assert.equal(packet.commercialResearch.needConfirmed,false);assert.equal(packet.commercialResearch.salesReview.humanIndividualApproval,false);});
test('rejects missing evidence and replaces candidate instead of counting reviewed inventory',async()=>{const f=fixture();const original=f.options.investigate;f.options.investigate=async l=>l.id==='recLead0'?{state:'SOURCE_UNVERIFIED'}:original(l);const worker=createLeadPreparation(f.options);for(let i=0;i<6;i++)await worker.run();const s=await worker.status();assert.equal(s.state,'READY');assert.equal(s.rejected.length,1);assert.ok(!s.selected.some(l=>l.recordId==='recLead0'));});
test('external access failure remains blocked, never clear or complete',async()=>{const f=fixture();f.options.apollo=async()=>{throw Object.assign(Error(),{code:'APOLLO_ACCESS_DENIED'})};const s=await createLeadPreparation(f.options).run();assert.equal(s.state,'BLOCKED');assert.equal(s.code,'APOLLO_ACCESS_DENIED');assert.equal(s.selected.length,0);});
test('exhausted inventory is explicit and cannot fulfill five with fewer records',async()=>{const f=fixture(2);await f.worker.run();await f.worker.run();const s=await f.worker.run();assert.equal(s.state,'BLOCKED');assert.equal(s.code,'SOURCE_EXHAUSTED_BEFORE_FIVE');assert.equal(s.selected.length,2);});
test('readback failure and mailbox history cannot produce approved leads',async()=>{for(const kind of ['readback','history']){const f=fixture();if(kind==='readback')f.options.readLead=async()=>({fields:{Notes:''}});else f.options.gmail.search=async()=>[{id:'prior'}];const s=await createLeadPreparation(f.options).run();assert.equal(s.selected.length,0);assert.equal(s.rejected.length,1);}});
test('QA and excluded market never reach investigation',async()=>{const f=fixture(2);f.leads[0].fields['Data Quality']='QA';f.leads[1].fields.Country='El Salvador';assert.equal((await f.worker.run()).code,'SOURCE_EXHAUSTED_BEFORE_FIVE');assert.equal(f.count(),0);});
test('READY package drops revoked approval and refreshes stale history instead of reusing',async()=>{
 const f=fixture();for(let i=0;i<5;i++)await f.worker.run();f.leads[0].fields.Notes='Approval revoked';
 const next=await f.worker.run();assert.notEqual(next.reused,true);assert.equal(f.count(),6);
 f.options.now=()=> '2026-10-18T16:00:00Z';const refreshed=await createLeadPreparation(f.options).run();assert.notEqual(refreshed.reused,true);assert.ok(refreshed.selected.length<5);
});

 test('subjects reflect researched signal and never present unverified needs as facts',async()=>{
 const {outreachTopic}=await import('../lib/rsi01_lead_preparation.js');
 assert.notEqual(outreachTopic({type:'QUOTE_INTAKE'})[0],outreachTopic({type:'SUPPORT_REQUEST'})[0]);
 assert.match(outreachTopic({type:'QUOTE_INTAKE'})[0],/quote/i);
 assert.match(outreachTopic({type:'SUPPORT_REQUEST'})[0],/support/i);
 assert.match(outreachTopic({type:'APPOINTMENT_BOOKING'})[0],/appointment/i);
 assert.match(outreachTopic({type:'UNKNOWN'})[0],/inquiry/i);
 });

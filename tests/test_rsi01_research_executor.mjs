import test from 'node:test';import assert from 'node:assert/strict';import {assessCase,executeResearch,discoverResearchCandidates,seedResearchQueue,buildCommercialReviewPacket} from '../lib/rsi01_research_executor.js';
const lead={id:'rec1',fields:{'Contact Email':'buyer@example.com','Company URL':'https://example.com'}},work={id:'work1',fields:{RSI:'RSI-01',Status:'PENDING_RSI01_RESEARCH','Source Record ID':'rec1',Evidence:''}};
test('incomplete evidence never approved',()=>{const r=assessCase(work,lead);assert.equal(r.approvalGranted,false);assert.ok(r.reasons.includes('BUYER_ROLE_UNVERIFIED'))});
test('complete documented case still requires commercial approval',()=>{const r=assessCase(work,{...lead,fields:{...lead.fields,'Buyer Role':'Owner','Source Evidence URL':'https://example.com/about','Problem Confirmed':true}});assert.equal(r.status,'COMMERCIAL_APPROVAL_REVIEW');assert.equal(r.sendingEnabled,false)});
test('writes case-level evidence and no outbound',async()=>{let patch;const r=await executeResearch({work:[work],leads:[lead],investigate:async()=>({state:'SOURCE_UNVERIFIED',approvalGranted:false}),request:async(_t,args)=>{patch=args.body.records[0];return {records:[{id:'work1'}]}}});assert.equal(r.assessed,1);assert.equal(r.sendingEnabled,false);assert.equal(patch.fields.Status,'RESEARCH_EVIDENCE_PENDING')});

test('retry states return to active evidence investigation',()=>assert.equal(assessCase({...work,fields:{...work.fields,Status:'RESEARCH_RETRY_2'}},lead).status,'RESEARCH_EVIDENCE_PENDING'));

test('contact draft receives public investigation without self approval',async()=>{let written;const workDraft={...work,fields:{...work.fields,Status:'CONTACT_DRAFT_READY_REVIEW'}};const result=await executeResearch({work:[workDraft],leads:[lead],investigate:async()=>({state:'PUBLIC_WEBSITE_OBSERVED',url:'https://example.com',title:'Example'}),request:async(_t,args)=>{written=args.body.records[0];return {records:[{id:'work1'}]}}});assert.equal(result.assessed,1);assert.equal(written.fields.Status,'CONTACT_DRAFT_READY_REVIEW');assert.match(written.fields.Evidence,/PUBLIC_WEBSITE_OBSERVED/);assert.equal(result.sendingEnabled,false)});

test('rotates five-case research instead of reviewing the same five forever',async()=>{
 const works=Array.from({length:7},(_,i)=>({id:'work'+i,fields:{...work.fields,'Source Record ID':'rec'+i,'Updated At':'2026-10-01T00:00:00Z'}}));
 const leads=Array.from({length:7},(_,i)=>({id:'rec'+i,fields:{...lead.fields}}));
 const updates=[];
 const request=async(_table,args)=>{
  const record=args.body.records[0];updates.push(record.id);
  const current=works.find(w=>w.id===record.id);
  Object.assign(current.fields,record.fields);
  return {records:[{id:record.id}]};
 };
 const investigate=async()=>({state:'SOURCE_UNVERIFIED'});
 const first=await executeResearch({work:works,leads,request,limit:5,investigate,now:()=> '2026-10-17T15:00:00Z'});
 assert.equal(first.assessed,5);
 const second=await executeResearch({work:works,leads,request,limit:5,investigate,now:()=> '2026-10-18T15:00:00Z'});
 assert.equal(second.assessed,5);
 assert.deepEqual(updates.slice(0,5),['work0','work1','work2','work3','work4']);
 assert.deepEqual(updates.slice(5,7),['work5','work6']);
 assert.equal(first.sendingEnabled,false);
 assert.equal(second.sendingEnabled,false);
});

test('Agent 1 marks public operational signals as potential, never as confirmed need',async()=>{
 let written; const result=await executeResearch({work:[work],leads:[lead],investigate:async()=>({state:'PUBLIC_WEBSITE_OBSERVED',url:'https://example.com/',operationalSignals:[{type:'QUOTE_INTAKE',excerpt:'Request a quote'}]}),request:async(_t,args)=>{written=args.body.records[0];return {records:[{id:'work1'}]}}});
 assert.equal(result.decisions[0].commercialPhase,'POTENTIAL_NEED_SOURCE_OBSERVED');assert.equal(result.decisions[0].sendingEnabled,false);assert.match(written.fields.Evidence,/QUOTE_INTAKE/);assert.match(written.fields.Evidence,/approvalGranted":false/);assert.match(written.fields['Next Action'],/human confirmation/);
});

test('research prioritizes real safe company websites ahead of missing or mismatched URLs',async()=>{
 const works=['bad','mismatch','good'].map(id=>({id:'work'+id,fields:{...work.fields,'Source Record ID':'rec'+id}}));
 const leads=[{id:'recbad',fields:{'Contact Email':'a@example.com'}},{id:'recmismatch',fields:{'Company URL':'https://other.com','Contact Email':'a@example.com'}},{id:'recgood',fields:{'Company URL':'https://example.com','Contact Email':'sales@example.com'}}];
 const updated=[];
 const r=await executeResearch({work:works,leads,limit:1,investigate:async()=>({state:'PUBLIC_WEBSITE_OBSERVED',operationalSignals:[{type:'QUOTE_INTAKE',sourceUrl:'https://example.com/quote'}]}),request:async(_,args)=>{updated.push(args.body.records[0].id);return {records:[{id:args.body.records[0].id}]}}});
 assert.deepEqual(updated,['workgood']);assert.equal(r.decisions[0].commercialPhase,'POTENTIAL_NEED_SOURCE_OBSERVED');assert.equal(r.sendingEnabled,false);
});

test('research does not revisit same cases twice within a day',async()=>{
 const same={...work,fields:{...work.fields,Evidence:'[RSI01_RESEARCH_ASSESSMENT_V1]{"at":"2026-10-17T12:00:00Z"}[/RSI01_RESEARCH_ASSESSMENT_V1]',Status:'RESEARCH_RETRY_2'}};
 const r=await executeResearch({work:[same],leads:[lead],now:()=> '2026-10-17T19:00:00Z',request:async()=>{throw Error('should not write')}});
 assert.equal(r.assessed,0);
});

test('autonomous discovery creates only genuine CRM website tasks and no approved prospect',async()=>{
 const candidates=[{id:'recA',fields:{Name:'A',Country:'United States','Company URL':'https://example.com','Contact Email':'sales@example.com'}},{id:'recB',fields:{Name:'B','Contact Email':'b@x.com'}},{id:'recC',fields:{Name:'C','Company URL':'https://other.com','Contact Email':'sales@example.com'}}];
 assert.deepEqual(discoverResearchCandidates(candidates,[],{limit:5}).map(x=>x.id),['recA']);
 const result=await seedResearchQueue({leads:candidates,work:[],request:async(_t,args)=>{assert.equal(args.body.records[0].fields.Status,'PENDING_RSI01_RESEARCH');return {records:[{id:'workA'}]}}});
 assert.equal(result.length,1);assert.equal(result[0].fields['Source Record ID'],'recA');
 const packet=buildCommercialReviewPacket(candidates[0],{url:'https://example.com',operationalSignals:[{type:'QUOTE_INTAKE',sourceUrl:'https://example.com/quote',excerpt:'Request a quote'}]});
 assert.equal(packet.status,'REVIEW_REQUIRED');assert.equal(packet.contactEligible,false);assert.equal(packet.customerNeedConfirmed,false);assert.equal(packet.salesReview.accepted,false);
});

test('unresearchable records consume zero website investigation slots',async()=>{
 const bad={...lead,id:'bad',fields:{'Contact Email':'a@gmail.com'}};
 const good={...lead,id:'good'};
 const jobs=[{...work,id:'badJob',fields:{...work.fields,'Source Record ID':'bad'}},{...work,id:'goodJob',fields:{...work.fields,'Source Record ID':'good'}}];
 const called=[];
 const result=await executeResearch({work:jobs,leads:[bad,good],limit:1,now:()=> '2026-10-17T20:00:00Z',investigate:async x=>{called.push(x.id);return {state:'PUBLIC_WEBSITE_OBSERVED',url:'https://example.com/',operationalSignals:[{type:'QUOTE_INTAKE',excerpt:'Request a quote'}]}},request:async(_,args)=>({records:[{id:args.body.records[0].id}]})});
 assert.deepEqual(called,['good']);assert.equal(result.assessed,1);assert.equal(result.skippedUnresearchable,1);assert.equal(result.opportunitiesWithEvidence,1);
});

test('an individual research failure does not abort remaining cases',async()=>{
 const rows=['a','b'].map(id=>({id:'work'+id,fields:{...work.fields,'Source Record ID':'rec'+id}}));
 const people=['a','b'].map(id=>({id:'rec'+id,fields:{...lead.fields}}));
 const r=await executeResearch({work:rows,leads:people,limit:5,investigate:async x=>{if(x.id==='reca')throw Error('network');return {state:'PUBLIC_WEBSITE_OBSERVED'};},request:async(_,args)=>({records:[{id:args.body.records[0].id}]})});
 assert.equal(r.assessed,1);assert.equal(r.failed,1);assert.equal(r.failures[0].code,'PUBLIC_RESEARCH_FETCH_FAILED');assert.equal(r.sendingEnabled,false);
});

test('missing lead association and non-string evidence do not crash queue selection',async()=>{
 const valid={...lead,id:'recvalid'};const rows=[{id:'orphan',fields:{...work.fields,'Source Record ID':'unavailable'}},{id:'ok',fields:{...work.fields,'Source Record ID':'recvalid',Evidence:123}}];
 const r=await executeResearch({work:rows,leads:[valid],investigate:async()=>({state:'SOURCE_UNVERIFIED'}),request:async(_,args)=>({records:[{id:args.body.records[0].id}]})});
 assert.equal(r.assessed,1);assert.equal(r.failed,0);
});

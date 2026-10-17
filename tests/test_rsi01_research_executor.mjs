import test from 'node:test';import assert from 'node:assert/strict';import {assessCase,executeResearch} from '../lib/rsi01_research_executor.js';
const lead={id:'rec1',fields:{'Contact Email':'buyer@example.com','Company URL':'https://example.com'}},work={id:'work1',fields:{RSI:'RSI-01',Status:'PENDING_RSI01_RESEARCH','Source Record ID':'rec1',Evidence:''}};
test('incomplete evidence never approved',()=>{const r=assessCase(work,lead);assert.equal(r.approvalGranted,false);assert.ok(r.reasons.includes('BUYER_ROLE_UNVERIFIED'))});
test('complete documented case still requires commercial approval',()=>{const r=assessCase(work,{...lead,fields:{...lead.fields,'Buyer Role':'Owner','Source Evidence URL':'https://example.com/about','Problem Confirmed':true}});assert.equal(r.status,'COMMERCIAL_APPROVAL_REVIEW');assert.equal(r.sendingEnabled,false)});
test('writes case-level evidence and no outbound',async()=>{let patch;const r=await executeResearch({work:[work],leads:[lead],investigate:async()=>({state:'SOURCE_UNVERIFIED',approvalGranted:false}),request:async(_t,args)=>{patch=args.body.records[0];return {records:[{id:'work1'}]}}});assert.equal(r.assessed,1);assert.equal(r.sendingEnabled,false);assert.equal(patch.fields.Status,'RESEARCH_EVIDENCE_PENDING')});

test('retry states cannot be reset by evidence assessment',()=>assert.equal(assessCase({...work,fields:{...work.fields,Status:'RESEARCH_RETRY_2'}},lead),null));

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

import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCompanyDraft,reviewNamedBuyerDraft} from '../lib/agent1_company_draft_review.js';

const lead={
 id:'lead-1',status:'NEW',commercial_stage:'DRAFT_REVIEW',
 source_payload:{
  companyCampaignDraft:{recipient:'sales@example.com',recipientType:'OFFICIAL_COMPANY_MAILBOX',sendAuthorized:false},
  leadEvidence:{companyMailboxVerification:{status:'OFFICIAL_COMPANY_MAILBOX_VERIFIED',email:'sales@example.com'}},
  recipientEligibility:{approved:true},suppressionCheck:{status:'CLEAR'}
 }
};
const gmail={verify:async()=>({verified:true}),search:async()=>[]};
test('verified official inbox with clear Supabase eligibility remains blocked pending native dispatch',async()=>{
 const r=await reviewCompanyDraft(lead,{leads:[lead],gmail});
 assert.equal(r.gmail,'CLEAR');
 assert.equal(r.crm,'ELIGIBLE');
 assert.equal(r.suppression,'CLEAR');
 assert.equal(r.sendAuthorized,false);
 assert.equal(r.reason,'SUPABASE_DISPATCH_NOT_CONFIGURED');
});
test('previous contact blocks review',async()=>{
 const r=await reviewCompanyDraft(lead,{leads:[lead,{id:'lead-2',contact_email:'sales@example.com',status:'CONTACTED'}],gmail});
 assert.equal(r.reason,'EXISTING_CRM_HISTORY');
 assert.equal(r.sendAuthorized,false);
});
test('missing eligibility fails closed',async()=>{
 const payload={...lead.source_payload,recipientEligibility:null};
 const r=await reviewCompanyDraft({...lead,source_payload:payload},{leads:[],gmail});
 assert.equal(r.reason,'SUPABASE_ELIGIBILITY_OR_SUPPRESSION_NOT_CLEARED');
});
test('gmail unavailability fails closed',async()=>{
 const r=await reviewCompanyDraft(lead,{leads:[],gmail:{verify:async()=>{throw Error('offline')}}});
 assert.equal(r.reason,'GMAIL_READ_UNAVAILABLE');
 assert.equal(r.sendAuthorized,false);
});

const now=new Date('2026-10-23T16:28:00Z');
const named={
 id:'edm-real-shape',name:'EDM Express',company_url:'https://edmexpress.com',source_evidence_url:'https://edmexpress.com/',
 contact_email:'joe@edmexpress.com',status:'NEW',commercial_stage:'DRAFT_REVIEW',
 source_payload:{
  campaignDraft:{marketingContentId:'quote-material',sent:false},
  leadEvidence:{personalCandidateVerified:true,sendAuthorized:false},
  verification:{checkedAt:'2026-10-23T16:00:00Z',emailSyntax:true,emailPublished:true,namedContactPublished:true,rolePublished:true,mxVerified:true,publishedWorkflow:'QUOTE_REQUEST'},
  recipientEligibility:{approved:true},suppressionCheck:{status:'CLEAR'}
 }
};
const materials=[{id:'quote-material',workflow:'QUOTE_REQUEST',body:'Quoted workflow content',distribution_status:'SALES_QUEUE_READY'}];
const buyerGmail={verify:async()=>({verified:true}),search:async()=>[]};
const review=async(lead=named,options={})=>reviewNamedBuyerDraft(lead,{leads:[lead],gmail:buyerGmail,marketingRuns:materials,now,...options});
test('named buyer with published email is reviewed but never auto-authorized',async()=>{
 const r=await review();assert.equal(r.reason,'OUTBOUND_AUTHORIZATION_REQUIRED');assert.equal(r.sendAuthorized,false);
 assert.equal(r.gmail,'CLEAR');assert.equal(r.marketing,'VERIFIED');assert.equal(r.marketingContentId,'quote-material');
});
test('named buyer review fails closed on Gmail errors and existing history',async()=>{
 const unavailable=await review(named,{gmail:{verify:async()=>{throw Error('permission denied')}}});
 assert.equal(unavailable.reason,'GMAIL_READ_UNAVAILABLE');assert.equal(unavailable.sendAuthorized,false);
 const duplicate=await review(named,{leads:[named,{id:'other',status:'CONTACTED',contact_email:'joe@edmexpress.com'}]});
 assert.equal(duplicate.reason,'EXISTING_CRM_HISTORY');assert.equal(duplicate.sendAuthorized,false);
 const prior=await review(named,{gmail:{verify:async()=>({verified:true}),search:async()=>[{id:'already-sent'}]}});
 assert.equal(prior.reason,'GMAIL_HISTORY_FOUND');assert.equal(prior.sendAuthorized,false);
});
test('named buyer review blocks stale evidence, mismatched marketing and missing eligibility',async()=>{
 const stale=structuredClone(named);stale.source_payload.verification.checkedAt='2026-10-21T16:00:00Z';
 assert.equal((await review(stale)).reason,'NAMED_BUYER_EVIDENCE_NOT_CURRENT');
 const future=structuredClone(named);future.source_payload.verification.checkedAt='2026-10-24T16:00:00Z';
 assert.equal((await review(future)).reason,'NAMED_BUYER_EVIDENCE_NOT_CURRENT');
 const wrong=await review(named,{marketingRuns:[{...materials[0],workflow:'SERVICE_ROUTING'}]});
 assert.equal(wrong.reason,'MARKETING_ASSET_NOT_VERIFIED');
 const noPermission=structuredClone(named);noPermission.source_payload.recipientEligibility.approved=false;
 assert.equal((await review(noPermission)).reason,'SUPABASE_ELIGIBILITY_OR_SUPPRESSION_NOT_CLEARED');
 const suppressed=structuredClone(named);suppressed.source_payload.suppressionCheck.status='REVIEW_REQUIRED';
 assert.equal((await review(suppressed)).reason,'SUPABASE_ELIGIBILITY_OR_SUPPRESSION_NOT_CLEARED');
});
test('explicit authorization only clears review; repeated review does not send or duplicate',async()=>{
 const authorized=structuredClone(named);authorized.source_payload.leadEvidence.sendAuthorized=true;
 const first=await review(authorized),second=await review(authorized);
 assert.equal(first.result,'ELIGIBLE');assert.equal(first.sendAuthorized,true);assert.deepEqual(first,second);
});

test('named-buyer suppression probe records independent evidence without granting approval',async()=>{
 const missing=structuredClone(named);delete missing.source_payload.recipientEligibility;
 const evidence={status:'CLEAR',recipient:missing.contact_email,checkedAt:now.toISOString(),sources:['supabase/leads','redis/dnc']};
 const r=await review(missing,{suppressionProbe:async()=>evidence});
 assert.equal(r.suppression,'CLEAR');assert.deepEqual(r.suppressionEvidence,evidence);
 assert.equal(r.crm,'REVIEW_REQUIRED');assert.equal(r.sendAuthorized,false);
 const blocked=await review(named,{suppressionProbe:async()=>({...evidence,status:'BLOCKED'})});
 assert.equal(blocked.reason,'SUPPRESSION_LIST_MATCH');assert.equal(blocked.sendAuthorized,false);
 const unavailable=await review(named,{suppressionProbe:async()=>{throw Error('redis offline')}});
 assert.equal(unavailable.reason,'SUPPRESSION_CHECK_UNAVAILABLE');assert.equal(unavailable.sendAuthorized,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCompanyDraft} from '../lib/agent1_company_draft_review.js';

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

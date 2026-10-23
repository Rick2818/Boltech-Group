import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRecipientV2} from '../lib/commercial_verifier_v2.js';
const now=new Date('2026-10-23T18:00:00Z');
const lead={id:'example',contact_email:'buyer@example.com',company_url:'https://example.com',source_evidence_url:'https://example.com/team',source_payload:{verification:{checkedAt:'2026-10-23T17:00:00Z',emailSyntax:true,emailPublished:true,namedContactPublished:true,rolePublished:true,mxVerified:true,publishedWorkflow:'QUOTE_REQUEST'},leadEvidence:{personalCandidateVerified:true,sendAuthorized:true},recipientEligibility:{approved:true},campaignDraft:{sent:false,marketingContentId:'asset'}}};
const deps={now,marketingRuns:[{id:'asset',workflow:'QUOTE_REQUEST',body:'Example',distribution_status:'SALES_QUEUE_READY'}],checkDuplicates:async()=>false,checkSuppression:async()=>({status:'CLEAR',checkedAt:now.toISOString(),recipient:'buyer@example.com'}),checkHistory:async()=>[],policy:async()=>({eligible:true,authorized:true,policyId:'QA_TEST'})};
test('all required evidence gives CLEAR without sending',async()=>{const x=await evaluateRecipientV2(lead,deps);assert.equal(x.status,'CLEAR');assert.equal(x.sendAuthorized,true);});
test('missing DNC cannot clear',async()=>assert.equal((await evaluateRecipientV2(lead,{...deps,checkSuppression:async()=>null})).status,'REVIEW_REQUIRED'));
test('DNC matched blocks',async()=>assert.equal((await evaluateRecipientV2(lead,{...deps,checkSuppression:async()=>({status:'BLOCKED'})})).status,'BLOCKED'));
test('Gmail read failing cannot clear',async()=>assert.equal((await evaluateRecipientV2(lead,{...deps,checkHistory:async()=>{throw Error('429')}})).status,'REVIEW_REQUIRED'));
test('existing Gmail history blocks',async()=>assert.equal((await evaluateRecipientV2(lead,{...deps,checkHistory:async()=>[{id:'x'}]})).status,'BLOCKED'));
test('V2 policy rejection cannot clear',async()=>assert.equal((await evaluateRecipientV2(lead,{...deps,policy:async()=>({eligible:true,authorized:false,policyId:'QA_TEST'})})).status,'REVIEW_REQUIRED'));
test('missing source cannot clear',async()=>assert.equal((await evaluateRecipientV2({...lead,source_evidence_url:'https://other.com'},deps)).status,'REVIEW_REQUIRED'));
test('future dated evidence cannot clear',async()=>assert.equal((await evaluateRecipientV2({...lead,source_payload:{...lead.source_payload,verification:{...lead.source_payload.verification,checkedAt:'2026-10-24T17:00:00Z'}}},deps)).status,'REVIEW_REQUIRED'));
test('no checker cannot clear',async()=>assert.equal((await evaluateRecipientV2(lead,{...deps,checkDuplicates:null})).status,'REVIEW_REQUIRED'));
test('duplicate blocks',async()=>assert.equal((await evaluateRecipientV2(lead,{...deps,checkDuplicates:async()=>true})).status,'BLOCKED'));
test('stale DNC receipt cannot clear',async()=>assert.equal((await evaluateRecipientV2(lead,{...deps,checkSuppression:async()=>({status:'CLEAR',checkedAt:'2026-10-22T17:00:00Z',recipient:'buyer@example.com'})})).status,'REVIEW_REQUIRED'));
test('legacy eligibility flag does not veto independent approved V2 policy',async()=>assert.equal((await evaluateRecipientV2({...lead,source_payload:{...lead.source_payload,recipientEligibility:{approved:false}}},deps)).status,'CLEAR'));

test('official shared company mailbox is eligible only with matching published proof',async()=>{
 const company={...lead,contact_email:'info@example.com',source_payload:{verification:{checkedAt:'2026-10-23T17:00:00Z',publishedWorkflow:'QUOTE_REQUEST'},leadEvidence:{companyMailboxVerification:{status:'OFFICIAL_COMPANY_MAILBOX_VERIFIED',email:'info@example.com'}},companyCampaignDraft:{recipientType:'OFFICIAL_COMPANY_MAILBOX',recipient:'info@example.com',sent:false,marketingContentId:'asset',subject:'Quote',body:'Hello'}}};
 const x=await evaluateRecipientV2(company,{...deps,checkSuppression:async()=>({status:'CLEAR',checkedAt:now.toISOString(),recipient:'info@example.com'})});
 assert.equal(x.status,'CLEAR');
 const bad=await evaluateRecipientV2({...company,source_payload:{...company.source_payload,leadEvidence:{companyMailboxVerification:{status:'UNVERIFIED',email:'info@example.com'}}}},{...deps,checkSuppression:async()=>({status:'CLEAR',checkedAt:now.toISOString(),recipient:'info@example.com'})});
 assert.equal(bad.status,'REVIEW_REQUIRED');
});

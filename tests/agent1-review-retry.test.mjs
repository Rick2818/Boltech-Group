import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {companyDraftReviewDue} from '../lib/agent1_continuous_cycle.js';
const source=readFileSync(fileURLToPath(new URL('../lib/agent1_continuous_cycle.js',import.meta.url)),'utf8');
const reviewSource=readFileSync(fileURLToPath(new URL('../lib/agent1_company_draft_review.js',import.meta.url)),'utf8');
const isDue=companyDraftReviewDue;
test('review queue retries stale reviews and retains untouched new drafts',()=>{
 const now=new Date('2026-10-22T12:00:00Z');
 assert.equal(isDue(null,now),true);
 assert.equal(isDue({checkedAt:'2026-10-21T11:59:59Z'},now),true);
 assert.equal(isDue({checkedAt:'2026-10-22T11:59:59Z'},now),false);
 assert.equal(isDue({checkedAt:'invalid'},now),true);
 assert.equal(isDue({checkedAt:'2026-10-22T11:49:00Z',reason:'GMAIL_READ_UNAVAILABLE'},now),true);
 assert.equal(isDue({checkedAt:'2026-10-22T11:55:00Z',reason:'GMAIL_READ_UNAVAILABLE'},now),false);
 assert.equal(isDue({checkedAt:'2026-10-22T12:01:00Z',reason:'GMAIL_READ_UNAVAILABLE'},now),true);
 assert.equal(isDue({checkedAt:'2026-10-22T11:49:00Z',reason:'SUPABASE_ELIGIBILITY_OR_SUPPRESSION_NOT_CLEARED',suppression:'REVIEW_REQUIRED'},now),true);
 assert.equal(isDue({checkedAt:'2026-10-22T11:55:00Z',reason:'SUPABASE_ELIGIBILITY_OR_SUPPRESSION_NOT_CLEARED',suppression:'REVIEW_REQUIRED'},now),false);
 assert.equal(isDue({checkedAt:'2026-10-22T11:49:00Z',reason:'SUPABASE_ELIGIBILITY_OR_SUPPRESSION_NOT_CLEARED',suppression:'CLEAR'},now),false);
 // EDM Express is blocked until explicit approvals are recorded; a new
 // decision must wake the queue without bypassing any review gate.
 const prior={checkedAt:'2026-10-22T11:59:59Z',reason:'SUPABASE_ELIGIBILITY_OR_SUPPRESSION_NOT_CLEARED',crm:'REVIEW_REQUIRED',suppression:'CLEAR',sendAuthorized:false};
 assert.equal(isDue(prior,now,{recipientEligibility:{approved:false},leadEvidence:{sendAuthorized:false},suppressionCheck:{status:'CLEAR'}}),false);
 assert.equal(isDue(prior,now,{recipientEligibility:{approved:true},leadEvidence:{sendAuthorized:false},suppressionCheck:{status:'CLEAR'}}),true);
 assert.equal(isDue(prior,now,{recipientEligibility:{approved:false},leadEvidence:{sendAuthorized:true},suppressionCheck:{status:'CLEAR'}}),true);
 assert.equal(isDue(prior,now,{recipientEligibility:{approved:false},leadEvidence:{sendAuthorized:false},suppressionCheck:{status:'BLOCKED'}}),true);
 assert.match(source,/companyDraftReviewDue\(x\.source_payload\.commercialReview,now,x\.source_payload\)/);
 assert.match(source,/await reviewCompanyDraft\(lead,/);
});
test('commercial review remains fail-closed without eligibility, suppression and dispatcher',()=>{
 assert.match(reviewSource,/eligibility\?\.approved===true/);
 assert.match(reviewSource,/suppression\?\.status==='CLEAR'/);
 assert.match(reviewSource,/sendAuthorized:false/);
 assert.match(reviewSource,/SUPABASE_DISPATCH_NOT_CONFIGURED/);
});

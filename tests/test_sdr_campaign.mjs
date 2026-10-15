import test from 'node:test';import assert from 'node:assert/strict';import {extractApprovedCandidate,runApprovedCampaign} from '../lib/sdr_campaign.js';
const c={recordId:'rec123',email:'buyer@example.com',status:'READY_FOR_CONTACT',contactEligible:true,commercialResearch:{salesReview:{accepted:true}}};
const row={id:'rec123',fields:{'Experiment Cohort':'RSI-01','Contact Email':'buyer@example.com',Notes:'[SDR_CANDIDATE_V1]'+JSON.stringify(c)+'[/SDR_CANDIDATE_V1]'}};
test('excludes unapproved',()=>assert.equal(extractApprovedCandidate({...row,fields:{...row.fields,Notes:''}}),null));
test('excludes suppression',()=>assert.equal(extractApprovedCandidate({...row,fields:{...row.fields,'Do Not Contact':true}}),null));
test('only approved goes to existing SDR',async()=>{let n=0;const r=await runApprovedCampaign({listLeads:async()=>[row,{...row,id:'different'}],send:async()=>{n++;return {job:{state:'SENT'},attempted:true}}});assert.equal(n,1);assert.equal(r.results[0].status,'SENT')});

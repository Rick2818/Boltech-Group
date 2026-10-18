import test from 'node:test';import assert from 'node:assert/strict';import {extractApprovedCandidate,runApprovedCampaign} from '../lib/sdr_campaign.js';
const c={recordId:'rec123',email:'buyer@example.com',status:'READY_FOR_CONTACT',contactEligible:true,commercialResearch:{salesReview:{accepted:true}}};
const row={id:'rec123',fields:{'Experiment Cohort':'RSI-01','Contact Email':'buyer@example.com',Notes:'[SDR_CANDIDATE_V1]'+JSON.stringify(c)+'[/SDR_CANDIDATE_V1]'}};
test('excludes unapproved',()=>assert.equal(extractApprovedCandidate({...row,fields:{...row.fields,Notes:''}}),null));
test('excludes suppression',()=>assert.equal(extractApprovedCandidate({...row,fields:{...row.fields,'Do Not Contact':true}}),null));
test('only approved goes to existing SDR',async()=>{let n=0;const r=await runApprovedCampaign({listLeads:async()=>[row,{...row,id:'different'}],send:async()=>{n++;return {job:{state:'SENT'},attempted:true}}});assert.equal(n,1);assert.equal(r.results[0].status,'SENT')});

test('unknown result reconciles without another send',async()=>{let sends=0,checks=0;const r=await runApprovedCampaign({listLeads:async()=>[row],send:async()=>{sends++;return {job:{id:'durable',state:'UNKNOWN'},attempted:true}},reconcile:async id=>{assert.equal(id,'durable');checks++;return {state:'SENT'}}});assert.equal(sends,1);assert.equal(checks,1);assert.equal(r.results[0].status,'SENT')});
test('uncertain result remains attention if provider cannot confirm',async()=>{const r=await runApprovedCampaign({listLeads:async()=>[row],send:async()=>({job:{id:'durable',state:'UNKNOWN'},attempted:true}),reconcile:async()=>({state:'UNKNOWN',reconciliation:'NO_UNIQUE_PROVIDER_RECEIPT'})});assert.equal(r.cycleStatus,'ATTENTION');assert.equal(r.results[0].reconciliation,'NO_UNIQUE_PROVIDER_RECEIPT')});
test('none approved is not reported as dispatch success',async()=>{const r=await runApprovedCampaign({listLeads:async()=>[{...row,fields:{...row.fields,Notes:''}}],send:async()=>{throw Error('should never send')}});assert.equal(r.cycleStatus,'NO_APPROVED_LEADS')});
test('exact-five preflight prevents partial dispatch when an approved record disappears',async()=>{
 const {runExactlyFiveCampaign}=await import('../lib/sdr_campaign.js');let sends=0;
 const rows=Array.from({length:5},(_,i)=>{const candidate={...c,recordId:'rec'+i,email:`sales@company${i}.com`};return {id:candidate.recordId,fields:{'Experiment Cohort':'RSI-01','Contact Email':candidate.email,Notes:'[SDR_CANDIDATE_V1]'+JSON.stringify(candidate)+'[/SDR_CANDIDATE_V1]'}}});
 const args={selected:rows.map(r=>({recordId:r.id})),listLeads:async()=>rows.slice(1),validate:()=>{},send:async()=>{sends++;return {job:{state:'SENT'}}}};
 assert.equal((await runExactlyFiveCampaign(args)).cycleStatus,'NO_APPROVED_LEADS');assert.equal(sends,0);
 args.listLeads=async()=>rows;args.validate=()=>{throw Error('stale')};assert.equal((await runExactlyFiveCampaign(args)).eligible,0);assert.equal(sends,0);
});

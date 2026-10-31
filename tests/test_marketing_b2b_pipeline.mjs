import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMarketingB2BDraft} from '../lib/marketing_b2b_pipeline.js';
const research=[{url:'https://example.org/report',title:'Industry report',observedAt:'2026-10-31'}];
test('fails closed without research',async()=>{
 await assert.rejects(()=>prepareMarketingB2BDraft({generator:async()=>({})}),/SOURCED_RESEARCH_REQUIRED/);
});
test('rejects shallow drafts without publishing',async()=>{
 const r=await prepareMarketingB2BDraft({research,generator:async()=>({subject:'Generic',body:'Call us'})});
 assert.equal(r.status,'REJECTED_QUALITY');
 assert.equal(r.publicationStatus,'NOT_PUBLISHED');
});
test('accepts structured B2B draft for review only',async()=>{
 const r=await prepareMarketingB2BDraft({research,generator:async()=>({
  subject:'Manufacturing RFQ process analysis',body:'Technical analysis '.repeat(40),
  industry:'Manufacturing',buyerRole:'COO',businessProblem:'Manual RFQ handling',
  proposedSolution:'Human-reviewed automation',kpis:['RFQ turnaround time']
 })});
 assert.equal(r.status,'READY_FOR_REVIEW');
 assert.equal(r.publicationStatus,'NOT_PUBLISHED');
});

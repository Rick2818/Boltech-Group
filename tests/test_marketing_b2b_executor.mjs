import test from 'node:test';
import assert from 'node:assert/strict';
import {runMarketingB2BPreparedCycle} from '../lib/marketing_b2b_executor.js';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'};
test('rejects shallow content without writing to Supabase',async()=>{
 let calls=0;
 const r=await runMarketingB2BPreparedCycle({env,research:[{url:'https://example.org/report',title:'Industry',observedAt:'2026-10-31'}],
  generator:async()=>({subject:'Short',body:'Short'}),fetcher:async()=>{calls++;throw Error('SHOULD_NOT_CALL');}});
 assert.equal(r.persisted,false);assert.equal(calls,0);
});
test('persists valid review-only B2B material with readback receipt',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>[{id:JSON.parse(calls[0].options.body)[0].id,distribution_status:'REVIEW_REQUIRED'}]};};
 const r=await runMarketingB2BPreparedCycle({env,research:[{url:'https://example.org/report',title:'Industry',observedAt:'2026-10-31'}],
  generator:async()=>({subject:'Manufacturing automation',body:'Technical analysis '.repeat(40),industry:'Manufacturing',buyerRole:'COO',
  businessProblem:'Manual RFQ handling',proposedSolution:'Human-reviewed integration',kpis:['RFQ turnaround']}),fetcher});
 assert.equal(r.status,'PERSISTED_FOR_REVIEW');assert.equal(calls.length,2);
 const row=JSON.parse(calls[0].options.body)[0];assert.equal(row.evidence.publicationStatus,'NOT_PUBLISHED');
 assert.equal(row.distribution_status,'REVIEW_REQUIRED');
});

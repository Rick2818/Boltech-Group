import test from 'node:test';import assert from 'node:assert/strict';import {extractPublicSignals,discoverExternalSignals} from '../lib/rsi01_external_discovery.js';
test('reject unrelated, old and duplicate public posts',()=>{const p={hits:[{objectID:'1234567',title:'Looking for automation for sales quoting process',created_at_i:1800000000},{objectID:'1234568',title:'A generic engineering blog post with no buyer request',created_at_i:1800000000}]};const a=extractPublicSignals(p,{existing:new Set(['1234568']),cutoff:1790000000});assert.equal(a.length,1);assert.equal(a[0].contactEligible,false)});
test('query public free discovery returns research-only, not verified leads',async()=>{const fetcher=async()=>({ok:true,json:async()=>({hits:[{objectID:'1234567',title:'Looking for automation for sales quoting process',created_at_i:1800000000}]})});const r=await discoverExternalSignals({fetcher,now:()=>new Date(1800001000000).toISOString()});assert.equal(r.found.length,1);assert.equal(r.qualifiedBusinessLeads,0);assert.equal(r.sendingEnabled,false)});

test('reject job searches and product-launch false positives',()=>{
 const t=1800000000; const payload={hits:[
 {objectID:'49689049',title:'Show HN: I made an automated day-by-day itinerary organizer',created_at_i:t},
 {objectID:'50129708',title:'Looking for a Remote Engineering Role',created_at_i:t},
 {objectID:'49724132',title:'DocMind – I built an AI document parser to end manual data entry solo',created_at_i:t},
 {objectID:'50129709',title:'Need a customer support automation workflow for our business',created_at_i:t}
 ]};
 const r=extractPublicSignals(payload,{cutoff:t-100});assert.deepEqual(r.map(x=>x.sourceId),['50129709']);
});

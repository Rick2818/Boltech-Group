import test from 'node:test';
import assert from 'node:assert/strict';
import { paginationGuard } from '../lib/store_pagination.js';
import { getCommercialCohortMetrics } from '../lib/commercial_cohort_store.js';
import { getVerifiedSalesMetrics } from '../lib/payment_store.js';
const row={id:'test',fields:{}};
test('pagination accepts complete empty and multi-page reads',()=>{
 const guard=paginationGuard();assert.equal(guard({records:[row],offset:'next'}),'next');assert.equal(guard({records:[]}),undefined);
});
test('pagination rejects missing records, invalid rows and invalid cursors',()=>{
 for(const page of [{}, {records:null},{records:[null]},{records:[{fields:[]}]},{records:[],offset:2},{records:[],offset:''}]) assert.throws(()=>paginationGuard()(page));
});
test('repeated cursor and bounded incomplete reads never yield complete totals',()=>{
 const guard=paginationGuard();guard({records:[row],offset:'next'});assert.throws(()=>guard({records:[row],offset:'next'}),/Incomplete/);
 assert.throws(()=>paginationGuard(1)({records:[row],offset:'more'}),/Incomplete/);
 assert.throws(()=>paginationGuard(10,1)({records:[],offset:'more'}),/Incomplete/);
 assert.equal(paginationGuard(1)({records:[row]}),undefined);
});
test('cohort and payment aggregations reject malformed and cyclic provider pages',async t=>{
 const old=globalThis.fetch, token=process.env.AIRTABLE_TOKEN;process.env.AIRTABLE_TOKEN='test';
 t.after(()=>{globalThis.fetch=old;if(token===undefined)delete process.env.AIRTABLE_TOKEN;else process.env.AIRTABLE_TOKEN=token;});
 for(const page of [{}, {records:[],offset:'repeat'}]) {
  globalThis.fetch=async()=>({ok:true,json:async()=>page,text:async()=>JSON.stringify(page)});
  await assert.rejects(getCommercialCohortMetrics());await assert.rejects(getVerifiedSalesMetrics());
 }
});

test('cash totals independently reject non-production, unpaid and invalid date records',async t=>{
 const old=globalThis.fetch, token=process.env.AIRTABLE_TOKEN;process.env.AIRTABLE_TOKEN='test';
 t.after(()=>{globalThis.fetch=old;if(token===undefined)delete process.env.AIRTABLE_TOKEN;else process.env.AIRTABLE_TOKEN=token;});
 const fields={Status:'PAID',Environment:'production','Expected Amount USD':49,'Provider Evidence':'verified','Provider Transaction ID':'tx','Paid At':'2026-10-02T00:00:00Z'};
 const records=[{}, {Environment:'sandbox'}, {Status:'CREATED'}, {'Paid At':'invalid'}, {'Provider Evidence':'  '}].map(p=>({fields:{...fields,...p}}));
 globalThis.fetch=async()=>({ok:true,text:async()=>JSON.stringify({records})});
 assert.deepEqual(await getVerifiedSalesMetrics(),{paidOrders:1,cashCollectedUsd:49});
});

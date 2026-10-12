import test from 'node:test';
import assert from 'node:assert/strict';
import qa from '../config/qa_case.json' with {type:'json'};
import {createMarketingMaintenance} from '../lib/marketing_maintenance.js';
import {createMarketingTrace} from '../lib/marketing_trace.js';
import {buildMarketingSupport} from '../lib/marketing_sales_support.js';
import handler from '../api/partners.js';

function fixture() {
  const account={id:'recQA202610100000',fields:{Name:qa.answers[7],'Contact Email':qa.answers[8],'Commercial Stage':'Contacted'}};
  const ids=['adk-support-RSI-01-2026-10-07','adk-support-RSI-02-2026-10-07','adk-support-RSI-03-2026-10-07','marketing-leadflow-RSI01-20261009'];
  const rows=ids.map((eventId,n)=>{const from=['RSI-01','RSI-02','RSI-03','RSI-01'][n];return {eventId,from,opportunityId:account.id,createdAt:'2026-10-10T15:00:00Z',material:buildMarketingSupport({rsi:from,accounts:[]})};});
  const used={...structuredClone(rows[0]),eventId:qa.requestId,marketingUse:{messageId:qa.requestId},usedBySales:true};rows.push(used);
  let writes=0;
  const marketing=createMarketingTrace({readEvent:async id=>structuredClone(rows.find(row=>row.eventId===id)),updateEvent:async(old,next)=>{assert.deepEqual(old,rows.find(row=>row.eventId===old.eventId));rows[rows.findIndex(row=>row.eventId===old.eventId)]=next;writes++;},listEvents:async()=>rows,lead:async()=>account,sender:'qa-sender@example.test',search:async()=>[],thread:async()=>[],now:()=> '2026-10-12T20:00:00Z'});
  return {rows,used:structuredClone(used),writes:()=>writes,worker:{queue:async()=>({pending:rows}),readOpportunity:async()=>account,marketing}};
}
test('bounded repair corrects four existing drafts, preserves used material and is idempotent',async()=>{
  const f=fixture(),worker=createMarketingMaintenance(f.worker);
  const result=await worker.repair();assert.equal(result.existingEvents,4);assert.equal(result.applied,true);assert.equal(result.sendingPerformed,false);
  assert.ok(result.events.every(row=>row.version===2 && row.reviewed));assert.deepEqual(f.rows.at(-1),f.used);
  assert.equal(f.rows[3].material.context.kind,'SUPPLIER_FIT');assert.match(f.rows[0].material.context.need,new RegExp(qa.answers[7]));
  const revisions=f.rows.map(row=>row.materialHistory?.length || 0);await worker.repair();assert.deepEqual(f.rows.map(row=>row.materialHistory?.length || 0),revisions);
});
test('missing event, owner changes and used material stop the repair before any write',async()=>{
  for(const mutate of [f=>f.rows.splice(0,1),f=>{f.rows[0].from='RSI-02';},f=>{f.rows[0].marketingUse={messageId:qa.requestId};}]) {
    const f=fixture();mutate(f);await assert.rejects(createMarketingMaintenance(f.worker).repair());assert.equal(f.writes(),0);
  }
});
test('Gmail failure is recorded without falsely reporting history or blocking draft repair',async()=>{
  const f=fixture();f.worker.marketing.reconcile=async()=>{throw Object.assign(Error('private detail'),{code:'GMAIL_OAUTH_AUTH_FAILED'});};
  const result=await createMarketingMaintenance(f.worker).repair();assert.ok(result.events.every(row=>row.reviewed));
  assert.ok(result.results.every(row=>row.history.code==='GMAIL_OAUTH_AUTH_FAILED'));assert.doesNotMatch(JSON.stringify(result),/private detail/);
});
test('maintenance rejects unauthenticated access before reaching CRM or Gmail',async t=>{
  const saved=process.env.PARTNER_API_TOKEN;process.env.PARTNER_API_TOKEN='qa-only';
  t.after(()=>{if(saved===undefined)delete process.env.PARTNER_API_TOKEN;else process.env.PARTNER_API_TOKEN=saved;});
  for(const method of ['GET','POST']) {const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await handler({url:'/api/partners?action=marketing-maintenance',method,headers:{}},res);assert.equal(res.code,401);
  }
});

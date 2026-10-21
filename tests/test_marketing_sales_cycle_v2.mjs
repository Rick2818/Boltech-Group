import test from 'node:test';
import assert from 'node:assert/strict';
import {runMarketingSalesCycle,createCanonicalMarketing} from '../lib/marketing_sales_cycle_v2.js';
import {canonicalCrm} from './helpers/canonical_marketing_crm.mjs';
const lead={id:'real-fixture-1',name:'Fabrication company',country:'US',status:'NEW',commercial_stage:'PREPARED',contact_email:'owner@example.test',data_quality:'REAL',source_evidence_url:'https://example.test/contact',source_payload:{campaignDraft:{subject:'Your quote requests',body:'I saw the quote request workflow published on your official site. Which handoff would you like to improve first?'}}};
const at='2026-10-21T18:00:00Z',sender='ricardo.boltechgroup@gmail.com';
function fixture(){const crm=canonicalCrm({leads:[structuredClone(lead)]});const messages={};const gmail={message:async id=>messages[id],search:async()=>Object.values(messages).filter(m=>m.sent).map(m=>({id:m.id})),thread:async id=>Object.values(messages).filter(m=>m.threadId===id)};return {...crm,gmail,messages,marketing:createCanonicalMarketing({db:crm.db,leads:crm.leads,gmail,now:()=>at})};}
test('prepares opportunity-specific material, persists strategy and does not infer use or a sale',async()=>{
 const f=fixture();const r=await runMarketingSalesCycle({...f,now:()=>at});assert.equal(r.status,'SALES_SUPPORT_ACTIVE');assert.equal(r.metrics.prepared,1);assert.equal(r.metrics.used,0);assert.equal(r.send,false);
 const brief=[...f.briefs.values()][0];assert.match(brief.evidence.strategy.primarySegment,/metal fabrication/);assert.equal(brief.evidence.funnel.confirmedPayments,null);assert.equal(brief.updated_at,at);assert.match(brief.evidence.contentPlan.text,/USD 990/);
 await runMarketingSalesCycle({...f,now:()=>at});assert.equal(f.work.size,1);
});
test('sales acceptance, real message use and customer response remain separate and survive another marketing cycle',async()=>{
 const f=fixture(),h=await f.marketing.ensure({lead,kind:'INITIAL',draft:lead.source_payload.campaignDraft});
 await f.marketing.accept(h,lead.source_payload.campaignDraft.body);assert.equal((await f.marketing.metrics()).used,0);
 f.messages.sent={id:'sent',from:sender,to:lead.contact_email,text:h.material.materials.en.text,sent:true,threadId:'thread',receivedAt:at};
 await f.marketing.use(h,'sent');f.messages.reply={id:'reply',from:lead.contact_email,to:sender,text:'Yes, we would like to review our intake process.',sent:false,threadId:'thread',receivedAt:'2026-10-21T18:00:01Z'};
 const later=createCanonicalMarketing({db:f.db,leads:f.leads,gmail:f.gmail,now:()=> '2026-10-21T18:00:02Z'});await later.result(f.messages.reply);
 await runMarketingSalesCycle({...f,now:()=>at});const m=await later.metrics();assert.deepEqual([m.accepted,m.used,m.resultsVerified],[1,1,1]);assert.equal(m.saleInferred,false);
});
test('old, unrelated, automatic and wrong-recipient messages cannot create marketing attribution',async()=>{
 for(const change of [{receivedAt:'2026-10-20T18:00:00Z'},{text:'Unrelated message'},{automatic:true},{to:'wrong@example.test'}]){
  const f=fixture(),h=await f.marketing.ensure({lead,kind:'INITIAL',draft:lead.source_payload.campaignDraft});await f.marketing.accept(h,h.material.materials.en.text);
  f.messages.sent={id:'sent',from:sender,to:lead.contact_email,text:h.material.materials.en.text,sent:true,threadId:'thread',receivedAt:at,...change};
  await assert.rejects(f.marketing.use(h,'sent'),/USAGE_UNVERIFIED/);assert.equal((await f.marketing.metrics()).used,0);
 }
});
test('same material concurrent acceptance/use cannot erase the durable provider receipt',async()=>{
 const f=fixture(),h=await f.marketing.ensure({lead,kind:'INITIAL',draft:lead.source_payload.campaignDraft});await Promise.all([f.marketing.accept(h,h.material.materials.en.text),f.marketing.accept(h,h.material.materials.en.text)]);
 f.messages.sent={id:'sent',from:sender,to:lead.contact_email,text:h.material.materials.en.text,sent:true,threadId:'thread',receivedAt:at};
 await Promise.all([f.marketing.use(h,'sent'),f.marketing.use(h,'sent')]);assert.equal((await f.marketing.metrics()).used,1);
});
test('runtime budget resumes more than five pending materials and excludes QA',async()=>{
 const crm=canonicalCrm({leads:Array.from({length:13},(_,i)=>({...structuredClone(lead),id:'real-'+i}))});let time=0;const db=async(p,o)=>{const r=await crm.db(p,o);if(o?.method==='POST'&&p.includes('/agent_work'))time+=100;return r;};
 const first=await runMarketingSalesCycle({db,leads:crm.leads,now:()=>at,clock:()=>time,budgetMs:650});assert.equal(first.preparedThisCycle,7);
 time=0;const second=await runMarketingSalesCycle({db,leads:crm.leads,now:()=>at,clock:()=>time,budgetMs:650});assert.equal(second.preparedThisCycle,6);assert.equal(crm.work.size,13);
 const f=fixture();await assert.rejects(f.marketing.ensure({lead:{...lead,data_quality:'SYNTHETIC_QA'},kind:'INITIAL',draft:lead.source_payload.campaignDraft}),/REQUEST_INVALID/);
});
test('provider receipt recovery records use without sending and a storage failure never accepts material',async()=>{
 const f=fixture(),h=await f.marketing.ensure({lead,kind:'INITIAL',draft:lead.source_payload.campaignDraft});await f.marketing.accept(h,h.material.materials.en.text);
 f.messages.sent={id:'sent',from:sender,to:lead.contact_email,text:h.material.materials.en.text,sent:true,threadId:'thread',receivedAt:at};await f.marketing.reconcile();assert.equal((await f.marketing.metrics()).used,1);
 const broken=createCanonicalMarketing({db:async()=>{throw Error('CRM_DOWN')},leads:[lead]});await assert.rejects(broken.ensure({lead,kind:'INITIAL',draft:lead.source_payload.campaignDraft}),/CRM_DOWN/);
});
test('rejects malformed secrets before network',async()=>{await assert.rejects(runMarketingSalesCycle({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'bad—key'},fetcher:()=>{throw Error('NETWORK_CALLED')}}),/INVALID_SERVICE_KEY/);});
test('separate buyer questions receive separate material receipts without changing the approved offer',async()=>{
 const f=fixture(),a=await f.marketing.ensure({lead,kind:'PRICING',triggerMessageId:'buyer-question-1'}),b=await f.marketing.ensure({lead,kind:'PRICING',triggerMessageId:'buyer-question-2'});
 assert.notEqual(a.eventId,b.eventId);assert.match(a.material.materials.en.text,/USD 990/);assert.equal(a.material.materials.en.text,b.material.materials.en.text);
});

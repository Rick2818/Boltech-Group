import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent1MarketplaceCycle} from '../lib/agent1_marketplace_cycle.js';
import {discoverFreelancerJobs} from '../lib/freelancer_project_source.js';
import {runMarketingSalesCycle} from '../lib/marketing_sales_cycle_v2.js';
import {readFileSync} from 'node:fs';

const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-only'};
const now=new Date('2026-10-31T18:00:00Z');
const good={source:'UPWORK',sourceId:'UPWORK-2116710960048985715',
  title:'n8n and AI automation specialist',
  sourceUrl:'https://www.upwork.com/jobs/~022116710960048985715',
  publishedAt:'2026-10-31T17:00:00Z',
  requestSummary:'Integrate n8n API and CRM workflows',
  contactChannel:'UPWORK_PROPOSAL',sendingEnabled:false};
test('the same commercial cycle persists real marketplace jobs without sending or spending',async()=>{
 const writes=[];
 const fetcher=async(url,opts)=>{
  assert.equal(opts.method,'POST');assert.match(url,/agent_work\?on_conflict=work_id/);
  const rows=JSON.parse(opts.body);writes.push(rows[0]);
  return {ok:true,text:async()=>JSON.stringify(rows)};
 };
 const response=await runAgent1MarketplaceCycle({env,now,fetcher,
   upwork:async()=>({source:'UPWORK',status:'OBSERVED',found:[good]}),
   freelancer:async()=>({source:'FREELANCER',status:'NOT_CONNECTED',code:'FREELANCER_OAUTH_REQUIRED',found:[]})});
 assert.equal(response.status,'MARKETPLACE_RESEARCH_ONLY');
 assert.equal(response.newOpportunities,1);
 assert.equal(response.outreachSent,0);
 assert.equal(response.proposalsSent,0);
 assert.equal(response.connectsSpent,0);
 assert.equal(response.operationalReadiness,'PARTIAL_OR_READY');
 assert.deepEqual(response.authorizationRequired,[{platform:'FREELANCER',code:'FREELANCER_OAUTH_REQUIRED'}]);
 assert.equal(writes[0].work_id,'AGENT1:MARKETPLACE:UPWORK-2116710960048985715');
 assert.equal(writes[0].execution_receipt.proposalStatus,'NOT_SUBMITTED');
});
test('fake URLs or external domains cannot enter the commercial queue',async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;throw Error('must not call');};
 const result=await runAgent1MarketplaceCycle({env,now,fetcher,
  upwork:async()=>({status:'OBSERVED',found:[{...good,sourceUrl:'https://evil.test/jobs/1'}]}),
  freelancer:async()=>({status:'NOT_CONNECTED',found:[]})});
 assert.equal(result.operationalReadiness,'PARTIAL_OR_READY');
 assert.equal(calls,0);assert.equal(result.newOpportunities,0);assert.equal(result.errors[0].code,'UNVERIFIED_PLATFORM_LISTING');
});
test('Freelancer source fails closed without official OAuth credentials',async()=>{
 const result=await discoverFreelancerJobs({env:{},fetcher:async()=>{throw Error('not allowed');}});
 assert.equal(result.status,'NOT_CONNECTED');assert.deepEqual(result.found,[]);
});
test('Marketing only prepares reviewable drafts linked to marketplace work',async()=>{
 const assets=[],briefs=[],handoffs=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/agent_work')&&options?.method!=='PATCH')return {ok:true,text:async()=>JSON.stringify([{work_id:'AGENT1:MARKETPLACE:'+good.sourceId,status:'PENDING',
   execution_receipt:{source:'UPWORK',sourceId:good.sourceId,sourceUrl:good.sourceUrl,title:good.title,summary:good.requestSummary,sendingEnabled:false,proposalStatus:'NOT_SUBMITTED'}}])};
  if(u.pathname.endsWith('/marketing_content_runs')){
    if(options?.method==='POST'){const x=JSON.parse(options.body);assets.push(...x);return {ok:true,text:async()=>JSON.stringify(x)};}
    return {ok:true,text:async()=>JSON.stringify(assets.map(x=>({id:x.id,distribution_status:x.distribution_status,evidence:x.evidence})))};
  }
  if(u.pathname.endsWith('/agent_work')&&options?.method==='PATCH'){
    const x=JSON.parse(options.body);handoffs.push(x);
    return {ok:true,text:async()=>JSON.stringify([{work_id:'AGENT1:MARKETPLACE:'+good.sourceId,execution_receipt:x.execution_receipt}])};
  }
  if(u.pathname.endsWith('/marketing_sales_briefs')&&options?.method==='POST'){briefs.push(...JSON.parse(options.body));return {ok:true,text:async()=>''};}
  if(u.pathname.endsWith('/marketing_sales_briefs'))return {ok:true,text:async()=>JSON.stringify([{id:'boltech-marketplace-proposal-support-v5',strategy_version:'2026-11-01-pain-to-value-v5'}])};
  throw Error('Unexpected DB route '+url);
 };
 const result=await runMarketingSalesCycle({env,fetcher});
 assert.equal(result.prepared,1);assert.equal(result.linked,1);assert.equal(result.proposalsSent,0);
 assert.equal(assets[0].distribution_status,'REVIEW_REQUIRED');
 assert.equal(assets[0].evidence.sourceUrl,good.sourceUrl);
 assert.equal(assets[0].evidence.proposalStatus,'NOT_SUBMITTED');
 assert.match(assets[0].body,/CRM data mappings/);
 assert.doesNotMatch(assets[0].body,/INTERNAL SALES NOTES|DISCOVER:/);
 assert.ok(assets[0].evidence.internalNotes.quantify);
 assert.equal(assets[0].evidence.learningStatus,'NO_VERIFIED_CUSTOMER_OUTCOME');
 assert.equal(assets[0].evidence.method,'PAIN_TO_VALUE_V1');
 assert.equal(assets[0].evidence.confidence,'LISTING_ONLY');
 assert.match(assets[0].body,/successful\?/);
 assert.equal(briefs[0].evidence.autonomousSend,false);
 assert.equal(handoffs[0].execution_receipt.marketingContentId,assets[0].id);
 assert.equal(handoffs[0].execution_receipt.proposalStatus,'NOT_SUBMITTED');
});
test('no scheduled Gmail cron and sales API routes cannot reach old senders',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(config.crons.length,0);
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(api,/import salesCycleHandler from '..\/lib\/agent1_marketplace_cycle.js'/);
 assert.match(api,/RETIRED_BY_MARKETPLACE_STRATEGY/);
});

test('Marketing rejects obsolete CRM leads, spoofed jobs and already submitted bids without any POST',async()=>{
 const fake=[
  {work_id:'OLD:EMAIL:LEAD',status:'PENDING',execution_receipt:{...good,source:good.source,proposalStatus:'NOT_SUBMITTED',sendingEnabled:false}},
  {work_id:'AGENT1:MARKETPLACE:'+good.sourceId,status:'PENDING',
    execution_receipt:{...good,proposalStatus:'APPLIED',sendingEnabled:false}},
  {work_id:'AGENT1:MARKETPLACE:UPWORK-111111111111',status:'PENDING',
    execution_receipt:{...good,sourceId:'UPWORK-111111111111',sourceUrl:'https://evil.test/jobs/111',proposalStatus:'NOT_SUBMITTED'}}
 ];
 let mutations=0;
 const fetcher=async(url,options)=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/agent_work'))return {ok:true,text:async()=>JSON.stringify(fake)};
  if(u.pathname.endsWith('/marketing_sales_briefs')&&options?.method==='POST'){
    mutations++;return {ok:true,text:async()=>''};
  }
  if(u.pathname.endsWith('/marketing_sales_briefs'))return {ok:true,text:async()=>JSON.stringify([
    {id:'boltech-marketplace-proposal-support-v5',strategy_version:'2026-11-01-pain-to-value-v5'}])};
  throw Error('Legacy work must not create drafts: '+url);
 };
 const r=await runMarketingSalesCycle({env,fetcher});
 assert.equal(r.observed,0);
 assert.equal(r.prepared,0);
 assert.equal(r.linked,0);
 assert.equal(r.ignoredNonMarketplace,3);
 assert.equal(mutations,1);
 assert.equal(r.proposalsSent,0);
});
test('Legacy send endpoints explicitly retired and marketplace production route intact',()=>{
 const source=readFileSync(new URL('../api/partners.js',import.meta.url),'utf8');
 for(const route of ['rsi01-daily','sdr-send','commercial-activation','marketing-multi-source-import','rsi-execute']){
   assert.match(source,new RegExp("'"+route+"'"));
 }
 assert.match(source,/LEGACY_COMMERCIAL_TRACTION_RETIRED/);
 assert.match(source,/UPWORK_FREELANCER_ONLY/);
});

test('fully disconnected platforms are reported as blocked without contact or spending',async()=>{
 const result=await runAgent1MarketplaceCycle({env,now,fetcher:async()=>{throw Error('no storage access expected')},
  upwork:async()=>({status:'BLOCKED',code:'UPWORK_CONNECT_AUTHORIZATION_REQUIRED',found:[]}),
  freelancer:async()=>({status:'NOT_CONNECTED',code:'FREELANCER_OAUTH_REQUIRED',found:[]})});
 assert.equal(result.operationalReadiness,'BLOCKED_PLATFORM_AUTH');
 assert.equal(result.allPlatformsConnected,false);
 assert.equal(result.authorizationRequired.length,2);
 assert.equal(result.proposalsSent,0);assert.equal(result.connectsSpent,0);
});

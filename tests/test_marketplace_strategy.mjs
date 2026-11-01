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
 assert.equal(writes[0].work_id,'AGENT1:MARKETPLACE:UPWORK-2116710960048985715');
 assert.equal(writes[0].execution_receipt.proposalStatus,'NOT_SUBMITTED');
});
test('fake URLs or external domains cannot enter the commercial queue',async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;throw Error('must not call');};
 const result=await runAgent1MarketplaceCycle({env,now,fetcher,
  upwork:async()=>({status:'OBSERVED',found:[{...good,sourceUrl:'https://evil.test/jobs/1'}]}),
  freelancer:async()=>({status:'NOT_CONNECTED',found:[]})});
 assert.equal(calls,0);assert.equal(result.newOpportunities,0);assert.equal(result.errors[0].code,'UNVERIFIED_PLATFORM_LISTING');
});
test('Freelancer source fails closed without official OAuth credentials',async()=>{
 const result=await discoverFreelancerJobs({env:{},fetcher:async()=>{throw Error('not allowed');}});
 assert.equal(result.status,'NOT_CONNECTED');assert.deepEqual(result.found,[]);
});
test('Marketing only prepares reviewable drafts linked to marketplace work',async()=>{
 const assets=[],briefs=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/agent_work'))return {ok:true,text:async()=>JSON.stringify([{work_id:'AGENT1:MARKETPLACE:'+good.sourceId,status:'PENDING',
   execution_receipt:{source:'UPWORK',sourceId:good.sourceId,sourceUrl:good.sourceUrl,title:good.title,summary:good.requestSummary,sendingEnabled:false}}])};
  if(u.pathname.endsWith('/marketing_content_runs')){const x=JSON.parse(options.body);assets.push(...x);return {ok:true,text:async()=>JSON.stringify(x)};}
  if(u.pathname.endsWith('/marketing_sales_briefs')&&options?.method==='POST'){briefs.push(...JSON.parse(options.body));return {ok:true,text:async()=>''};}
  if(u.pathname.endsWith('/marketing_sales_briefs'))return {ok:true,text:async()=>JSON.stringify([{id:'boltech-marketplace-proposal-support-v3',strategy_version:'2026-10-31-marketplace-only-v3'}])};
  throw Error('Unexpected DB route '+url);
 };
 const result=await runMarketingSalesCycle({env,fetcher});
 assert.equal(result.prepared,1);assert.equal(result.proposalsSent,0);
 assert.equal(assets[0].distribution_status,'REVIEW_REQUIRED');
 assert.equal(assets[0].evidence.sourceUrl,good.sourceUrl);
 assert.equal(assets[0].evidence.proposalStatus,'NOT_SUBMITTED');
 assert.equal(briefs[0].evidence.autonomousSend,false);
});
test('no scheduled Gmail cron and sales API routes cannot reach old senders',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(config.crons.length,0);
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(api,/import salesCycleHandler from '..\/lib\/agent1_marketplace_cycle.js'/);
 assert.match(api,/RETIRED_BY_MARKETPLACE_STRATEGY/);
});

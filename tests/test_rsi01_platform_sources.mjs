import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverN8nJobs,discoverUpworkJobs,discoverPlatformSources,storePlatformResearch} from '../lib/rsi01_platform_sources.js';
const now='2026-10-19T14:38:00Z';
const topic=(id,title,extra={})=>({id,title,created_at:'2026-10-18T12:00:00Z',category_id:13,closed:false,...extra});
const demand=topic(322466,'Looking for n8n automation for customer inquiries');
function fetcher(topics=[demand]){return async url=>({ok:true,json:async()=>url.endsWith('/13.json')?{topic_list:{topics}}:{id:Number(url.match(/\/t\/(\d+)/)[1]),post_stream:{posts:[{post_number:1,username:'buyer',cooked:'<p>We need help automating incoming requests.</p>'},{post_number:2,username:'seller',cooked:'Email seller@sample.com'}]}}});}
test('n8n reads real requester post, keeps original platform channel, invents no email',async()=>{
 const r=await discoverN8nJobs({fetcher:fetcher(),now});assert.equal(r.found.length,1);assert.equal(r.found[0].author,'buyer');assert.equal(r.found[0].contactChannel,'N8N_COMMUNITY_THREAD');assert.equal(r.found[0].contactEligible,false);assert.equal(r.found[0].email,undefined);assert.doesNotMatch(r.found[0].requestSummary,/seller@/);
});
test('n8n excludes supplier ads, stale, closed, future and already recorded topics',async()=>{
 const topics=[demand,topic(2,'For hire: n8n automation builder'),topic(3,'Looking for n8n expert',{closed:true}),topic(4,'Need n8n workflow',{created_at:'2024-01-01T00:00:00Z'}),topic(5,'Need n8n workflow',{created_at:'2027-01-01T00:00:00Z'})];
 const r=await discoverN8nJobs({fetcher:fetcher(topics),now,existing:new Set(['N8N_COMMUNITY-322466'])});assert.equal(r.found.length,0);
});
test('missing Upwork executor OAuth never impersonates the ChatGPT connector',async()=>{
 const r=await discoverUpworkJobs({env:{},now,clientFactory:()=>{throw Error('must not connect')}});assert.equal(r.status,'BLOCKED');assert.equal(r.code,'UPWORK_EXECUTOR_OAUTH_REQUIRED');assert.equal(r.chatConnectorIsSeparate,true);
});
test('official Upwork MCP uses only read tools and never submits or buys Connects',async()=>{
 const calls=[];let closed=false;
 const fake={listTools:async()=>({tools:[{name:'list_accounts'},{name:'find_jobs'}]}),callTool:async({name,arguments:args})=>{
  calls.push({name,args});const data=name==='list_accounts'?{accounts:[{org_uid:'org1',role:'TALENT'}]}:{jobs:[{id:'2112190523624029251',title:'n8n workflow automation',created_date:'2026-10-19T14:00:00Z',description:'Need workflow automation',applied:false}]};return {content:[{type:'text',text:JSON.stringify(data)}]};},close:async()=>{closed=true;}};
 const r=await discoverUpworkJobs({env:{UPWORK_MCP_ACCESS_TOKEN:'test-only'},now,clientFactory:async()=>fake});assert.equal(r.found.length,1);assert.equal(r.found[0].contactChannel,'UPWORK_PROPOSAL');assert.deepEqual(calls.map(x=>x.name),['list_accounts','find_jobs']);assert.equal(closed,true);
});
test('an Upwork outage does not stop n8n; five research slots remain a strict ceiling',async()=>{
 const items=Array.from({length:8},(_,i)=>({sourceId:'N8N_COMMUNITY-'+i}));
 const r=await discoverPlatformSources({now,upwork:async()=>{throw Error('expired')},n8n:async()=>({source:'N8N_COMMUNITY',status:'OBSERVED',found:items})});assert.equal(r.found.length,5);assert.equal(r.sources[0].status,'BLOCKED');assert.equal(r.verifiedBusinessLeads,0);
});
test('platform queue persists real evidence once and never promotes research to a complete lead',async()=>{
 const work=[],discover=async({existing})=>({sources:[{source:'N8N_COMMUNITY',status:'OBSERVED',observed:1}],found:existing.has('N8N_COMMUNITY-322466')?[]:[{sourceId:'N8N_COMMUNITY-322466',contactChannel:'N8N_COMMUNITY_THREAD',sourceUrl:'https://community.n8n.io/t/322466'}]});
 const request=async(table,{body})=>{assert.equal(table,'tblHVqUMifOFjlGvj');const row={id:'recPlatform',fields:body.records[0].fields};work.push(row);return {records:[row]};};
 const a=await storePlatformResearch({work,request,discover,now});const b=await storePlatformResearch({work,request,discover,now});assert.equal(a.stored,1);assert.equal(b.stored,0);assert.equal(work.length,1);assert.equal(a.verifiedBusinessLeads,0);assert.equal(a.sendingEnabled,false);
});
test('unconfirmed queue write is rejected and cannot claim persisted sources',async()=>{
 await assert.rejects(storePlatformResearch({work:[],now,discover:async()=>({sources:[],found:[{sourceId:'N8N_COMMUNITY-1'}]}),request:async()=>({records:[{id:'rec1',fields:{}}]})}),/PLATFORM_RESEARCH_WRITE_UNCONFIRMED/);
});
test('daily research cap survives a fresh process and does not accumulate five on every retry',async()=>{
 const work=Array.from({length:5},(_,i)=>({fields:{'Work ID':'RSI01:PLATFORM_SIGNAL:N8N_COMMUNITY-'+i,Evidence:JSON.stringify({observedAt:now})}}));
 const r=await storePlatformResearch({work,now,discover:async()=>{throw Error('limit reached')},request:async()=>{throw Error('must not write')}});
 assert.equal(r.dailyLimitReached,true);assert.equal(r.stored,0);
});

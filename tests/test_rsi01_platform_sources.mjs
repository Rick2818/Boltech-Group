import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverN8nJobs,discoverUpworkJobs,discoverPlatformSources,storePlatformResearch,reviewPlatformResearch,getUpworkToken,startUpworkAuthorization} from '../lib/rsi01_platform_sources.js';
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
const connectEnv={UPWORK_CONNECTOR_UID:'mcp.upwork.com/boltech-group',UPWORK_CONNECT_USER_ID:'trusted-owner',VERCEL_OIDC_TOKEN:'private-project-identity'};
test('managed credentials use fixed Vercel host and trusted server identity, with no redirect',async()=>{
 let calls=0;
 const token=await getUpworkToken({env:connectEnv,fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.vercel.com/v1/connect/token/mcp.upwork.com%2Fboltech-group');assert.equal(options.redirect,'error');
  assert.equal(options.headers.Authorization,'Bearer private-project-identity');assert.deepEqual(JSON.parse(options.body).subject,{type:'user',id:'trusted-owner'});
  return {ok:true,json:async()=>({token:'private-provider-token'})};
 }});assert.equal(calls,1);assert.equal(token,'private-provider-token');
});
test('missing runtime identity fails closed instead of falling back to another credential',async()=>{
 await assert.rejects(getUpworkToken({env:{UPWORK_CONNECTOR_UID:connectEnv.UPWORK_CONNECTOR_UID,UPWORK_MCP_ACCESS_TOKEN:'other-token'},fetcher:()=>{throw Error('must not fetch')}}),/UPWORK_CONNECT_RUNTIME_IDENTITY_REQUIRED/);
});
test('provider error details and secrets never reach a discovery receipt',async()=>{
 const result=await discoverUpworkJobs({env:connectEnv,fetcher:async()=>({ok:false,json:async()=>({error:{code:'user_authorization_required',message:'secret private-project-identity'}})})});
 assert.equal(result.code,'UPWORK_CONNECT_AUTHORIZATION_REQUIRED');assert.doesNotMatch(JSON.stringify(result),/private-project-identity|secret/);
});
test('authorization URLs are restricted to the official Connect origin',async()=>{
 const options={env:connectEnv,fetcher:async()=>({ok:true,json:async()=>({url:'https://connect.vercel.com/authorize/sca_test'})})};
 assert.equal((await startUpworkAuthorization(options)).authorizationCompleted,false);
 await assert.rejects(startUpworkAuthorization({...options,fetcher:async()=>({ok:true,json:async()=>({url:'https://other.example/authorize/test'})})}),/UPWORK_CONNECT_AUTH_URL_INVALID/);
});
test('platform research without a Lead ID is consumed exactly once into a durable review packet',async()=>{
 const item=(await discoverN8nJobs({fetcher:fetcher(),now})).found[0];
 const work=[{id:'recPlatform',fields:{'Work ID':'RSI01:PLATFORM_SIGNAL:'+item.sourceId,RSI:'RSI-01',Status:'PENDING_RSI01_RESEARCH',Evidence:JSON.stringify(item)}}];
 const request=async(table,{body})=>{const update=body.records[0];Object.assign(work[0].fields,update.fields);return {records:[work[0]]};};
 const first=await reviewPlatformResearch({work,request,now});const second=await reviewPlatformResearch({work,request,now});
 assert.equal(first.assessed,1);assert.equal(second.assessed,0);assert.equal(work[0].fields.Status,'PLATFORM_CONTACT_REVIEW_REQUIRED');
 const reviewed=JSON.parse(work[0].fields.Evidence);assert.equal(reviewed.review.owner,'RSI-01');assert.equal(reviewed.review.sendingEnabled,false);assert.equal(work[0].fields['Source Record ID'],undefined);assert.equal(reviewed.email,undefined);
});
test('malformed platform evidence is terminally rejected and unconfirmed writes are failures',async()=>{
 const work=[{id:'recBad',fields:{'Work ID':'RSI01:PLATFORM_SIGNAL:UPWORK-2112190523624029251',RSI:'RSI-01',Status:'PENDING_RSI01_RESEARCH',Evidence:'not JSON'}}];
 const result=await reviewPlatformResearch({work,now,request:async(table,{body})=>{assert.equal(body.records[0].fields.Status,'PLATFORM_RESEARCH_INVALID');return {records:[{id:'recBad',fields:{}}]};}});
 assert.equal(result.assessed,0);assert.equal(result.failed,1);
});

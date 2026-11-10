import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeoIntegrations} from '../cloudflare/leo-integrations.mjs';
const owner='qa-owner-access-not-a-real-secret';
const request=(body,auth=owner)=>new Request('https://boltech-group.pages.dev/api/leo-integrations',{
  method:'POST',headers:{Authorization:'Bearer '+auth},body:JSON.stringify(body)});
const environment=()=>({LEO_PLATFORM_TOKEN:owner,FREELANCER_OAUTH_TOKEN:'qa-provider-freelancer',FREELANCER_API_ENABLED:'true',EXPLEE_API_KEY:'qa-provider-explee'});

test('owner access fails closed before providers, status distinguishes configuration from verification',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('unexpected external request');};
 try{
  assert.equal((await handleLeoIntegrations(request({action:'check',platform:'explee'},'wrong'),environment())).status,401);
  assert.equal((await handleLeoIntegrations(request({action:'status'}),{})).status,503);
  const status=await (await handleLeoIntegrations(request({action:'status'}),environment())).json();
  assert.equal(status.verified,false);assert.equal(status.freelancer.configured,true);
  assert.doesNotMatch(JSON.stringify(status),/qa-provider|qa-owner/);
  assert.equal((await handleLeoIntegrations(request({action:'send',platform:'explee'}),environment())).status,400);
  assert.equal((await handleLeoIntegrations(request({action:'check',platform:'freelancer'}),{...environment(),FREELANCER_API_ENABLED:'false'})).status,409);
 }finally{globalThis.fetch=saved;}
});
test('connection checks use fixed official origins, no paid search and never follow redirects with keys',async()=>{
 const saved=globalThis.fetch;
 try{
  globalThis.fetch=async(url,init)=>{
   assert.equal(init.redirect,'manual');
   if(url.includes('freelancer.com')){assert.equal(url,'https://www.freelancer.com/api/users/0.1/self/');assert.equal(init.headers['Freelancer-OAuth-V1'],'qa-provider-freelancer');return Response.json({status:'success',result:{id:12345,email:'private-account@example.invalid'}});}
   assert.equal(url,'https://api.explee.com/public/api/v1/search/nl-to-filters');
   assert.deepEqual(JSON.parse(init.body),{query:'Business workflow automation companies'});
   return Response.json({success:true,companies_filters:{definition:'workflow'},people_filters:{}});
  };
  for(const platform of ['freelancer','explee']){
   const result=await (await handleLeoIntegrations(request({action:'check',platform}),environment())).json();
   assert.equal(result.status,'CONNECTED');assert.doesNotMatch(JSON.stringify(result),/private-account|qa-provider/);
  }
  globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://attacker.example'}});
  const response=await handleLeoIntegrations(request({action:'check',platform:'explee'}),environment());
  assert.equal(response.status,502);assert.equal((await response.json()).error,'PROVIDER_HTTP_302');
 }finally{globalThis.fetch=saved;}
});
test('Explee search is confined to ten free-preview companies and creates genuine read receipts without contacts',async()=>{
 const saved=globalThis.fetch;const rows=[];
 const env={...environment(),COMMERCE:{put:async(k,v)=>rows.push(JSON.parse(v))}};
 try{
  globalThis.fetch=async(url,init)=>{
   assert.equal(url,'https://api.explee.com/public/api/v1/search/companies');
   assert.deepEqual(JSON.parse(init.body),{filters:{definition:'clinics in El Salvador'},page:1,page_size:10});
   return Response.json({success:true,companies:[{name:'QA Company',domain:'example.invalid',emails:['private@example.invalid']}],meta:{credits_charged:0}});
  };
  const result=await (await handleLeoIntegrations(request({action:'search',platform:'explee',query:'clinics in El Salvador',page:9,page_size:1000,exclude_lists:['paid']}),env)).json();
  assert.equal(result.items.length,1);assert.equal(result.meta.creditsCharged,0);
  assert.equal(rows[0].status,'STARTED');assert.equal(rows[1].status,'COMPLETED');assert.equal(rows[1].id,result.receiptId);
  assert.doesNotMatch(JSON.stringify(result),/private@|qa-provider/);
  globalThis.fetch=async()=>new Response('billing details',{status:402});
  const failed=await (await handleLeoIntegrations(request({action:'search',platform:'explee',query:'clinics'}),env)).json();
  assert.equal(failed.error,'PROVIDER_HTTP_402');assert.equal(rows.at(-1).status,'FAILED');
 }finally{globalThis.fetch=saved;}
});
test('Freelancer searches never bid and fail before requests if receipt storage is absent',async()=>{
 const saved=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(url,init)=>{
   calls++;const parsed=new URL(url);assert.equal(parsed.origin,'https://www.freelancer.com');assert.equal(parsed.pathname,'/api/projects/0.1/projects/active/');
   assert.equal(parsed.searchParams.get('limit'),'10');assert.equal(parsed.searchParams.get('query'),'n8n & CRM');
   assert.equal(init.method,undefined);
   return Response.json({status:'success',result:{projects:[{id:12345,title:'CRM project',seo_url:'crm/project',budget:{minimum:20,maximum:30},currency:{code:'USD'}}]}});
  };
  assert.equal((await handleLeoIntegrations(request({action:'search',platform:'freelancer',query:'n8n & CRM'}),environment())).status,503);
  assert.equal(calls,0);
  const result=await (await handleLeoIntegrations(request({action:'search',platform:'freelancer',query:'n8n & CRM'}),{...environment(),COMMERCE:{put:async()=>{}}})).json();
  assert.equal(result.items[0].id,'12345');assert.deepEqual(result.authorizedActions,[]);assert.equal(calls,1);
 }finally{globalThis.fetch=saved;}
});

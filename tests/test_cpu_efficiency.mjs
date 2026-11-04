import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';
import {runMarketingSalesCycle} from '../lib/marketing_sales_cycle_v2.js';

function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;}};}
test('lightweight routes work without loading SDKs or contacting providers',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected network');};
 try{
  for(const [method,url,status] of [['OPTIONS','/api/index',200],['GET','/api/catalog',200],['POST','/api/agent1-autonomous-inbox',410],['POST','/api/agent1-evidence-executor',410],['POST','/api/explee-hot-leads-sync',410],['POST','/api/dashboard/trigger-dispatch',410],['GET','/api/payment/confirm',410],['GET','/api/unknown',410]]){
   const res=response();await handler({method,url,headers:{host:'localhost'}},res);
   assert.equal(res.code,status,url);assert.ok(res.headers['X-Content-Type-Options']);
  }
 }finally{globalThis.fetch=original;}
});
const env={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only'};
const version='2026-11-01-pain-to-value-v5';
function fixture(count,{missing=false,tampered=false,batchFailure=false}={}){
 const rows=Array.from({length:count},(_,i)=>{const sourceId='UPWORK-'+(2116710960048985715n+BigInt(i));return {work_id:'AGENT1:MARKETPLACE:'+sourceId,status:'PENDING',execution_receipt:{source:'UPWORK',sourceId,sourceUrl:'https://www.upwork.com/jobs/~02'+sourceId.slice(7),title:'n8n automation',summary:'CRM integration',sendingEnabled:false,proposalStatus:'NOT_SUBMITTED',marketingContentId:'marketing-v5-platform-'+sourceId,marketingStrategyVersion:version,marketingStatus:'DRAFT_READY_FOR_OWNER_REVIEW'}};});
 const assets=new Map(rows.map(row=>[row.execution_receipt.marketingContentId,{id:row.execution_receipt.marketingContentId,distribution_status:'REVIEW_REQUIRED',evidence:{workId:row.work_id,sourceId:row.execution_receipt.sourceId,sourceUrl:row.execution_receipt.sourceUrl,strategyVersion:version,method:'PAIN_TO_VALUE_V1'}}]));
 if(missing)assets.clear();if(tampered)for(const asset of assets.values())asset.evidence.workId='WRONG';
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url,method:options.method||'GET'});const u=new URL(url);let result;
  if(u.pathname.endsWith('/agent_work')){
   result=options.method==='PATCH'?[{execution_receipt:JSON.parse(options.body).execution_receipt}]:rows;
  }else if(u.pathname.endsWith('/marketing_content_runs')){
   if(options.method==='POST'){const [asset]=JSON.parse(options.body);if(!assets.has(asset.id)){assets.set(asset.id,asset);result=[asset];}else result=[];}
   else if(u.searchParams.get('id').startsWith('in.')){
    if(batchFailure)return {ok:false,status:503};
    const ids=u.searchParams.get('id').slice(4,-1).split(',');result=ids.flatMap(id=>assets.has(id)?[assets.get(id)]:[]);
   }else{const asset=assets.get(u.searchParams.get('id').slice(3));result=asset?[asset]:[];}
  }else if(u.pathname.endsWith('/marketing_sales_briefs'))result=options.method==='POST'?null:[{id:'boltech-marketplace-proposal-support-v5',strategy_version:version}];
  else throw Error('Unexpected URL');
  return {ok:true,text:async()=>result===null?'':JSON.stringify(result)};
 };
 return {fetcher,calls};
}
test('100 verified linked drafts require 8 requests rather than 303, without rewriting jobs',async()=>{
 const f=fixture(100);const result=await runMarketingSalesCycle({env,fetcher:f.fetcher});
 assert.equal(result.linked,100);assert.equal(result.reused,100);assert.equal(result.prepared,0);
 assert.equal(f.calls.length,8);assert.equal(f.calls.filter(x=>x.method==='PATCH').length,0);
 assert.equal(f.calls.filter(x=>x.method==='POST').length,1);assert.equal(result.proposalsSent,0);
});
test('a missing linked asset is recreated and read back before relinking',async()=>{
 const f=fixture(1,{missing:true});const result=await runMarketingSalesCycle({env,fetcher:f.fetcher});
 assert.equal(result.prepared,1);assert.equal(result.linked,1);assert.equal(f.calls.filter(x=>x.method==='PATCH').length,1);
});
test('mismatched evidence does not count as a successful handoff',async()=>{
 const f=fixture(1,{tampered:true});const result=await runMarketingSalesCycle({env,fetcher:f.fetcher});
 assert.equal(result.linked,0);assert.deepEqual(result.blocked,['MARKETING_ASSET_NOT_VERIFIED']);
 assert.equal(f.calls.filter(x=>x.method==='PATCH').length,0);
});
test('provider failure aborts rather than trusting a stale receipt',async()=>{
 const f=fixture(1,{batchFailure:true});await assert.rejects(runMarketingSalesCycle({env,fetcher:f.fetcher}),/HTTP_503/);
 assert.equal(f.calls.filter(x=>x.method!=='GET').length,0);
});

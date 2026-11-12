import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{EXPLEE_TARGET_COUNTRIES} from '../cloudflare/pages-leo-audio-worker.mjs';

test('Explee sends exactly the six approved countries with a bounded free first page',async t=>{
 const saved=globalThis.fetch;t.after(()=>{globalThis.fetch=saved;});
 let calls=0;const receipts=[];
 const env={LEO_PLATFORM_TOKEN:'synthetic-owner-token-never-production',EXPLEE_API_KEY:'synthetic-explee-token',COMMERCE:{get:async()=>null,put:async(key,value)=>receipts.push(JSON.parse(value))}};
 globalThis.fetch=async(url,init)=>{
  calls++;assert.equal(url,'https://api.explee.com/public/api/v1/search/companies');
  const body=JSON.parse(init.body);
  assert.deepEqual(body,{filters:{definition:'import distributors',geo_include:['SV','GT','PA','CO','MX','US'],geo_include_empty:false,location_hq:true,location_customer:false},page:1,page_size:10});
  assert.equal(init.redirect,'manual');
  return Response.json({companies:[{name:'SYN Pdro Imports',domain:'pdro.example.test'}],meta:{credits_charged:0}});
 };
 const request=authorized=>new Request('https://boltech-group.pages.dev/api/leo-integrations',{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer '+env.LEO_PLATFORM_TOKEN}:{})},body:JSON.stringify({action:'search',platform:'explee',query:'import distributors',geo_include:['CN']})});
 assert.equal((await worker.fetch(request(false),env)).status,401);assert.equal(calls,0);
 const result=await(await worker.fetch(request(true),env)).json();
 assert.equal(result.success,true);assert.deepEqual(result.meta.targetCountries,EXPLEE_TARGET_COUNTRIES);
 assert.equal(result.meta.geographyVerification,'PROVIDER_FILTER_REQUESTED');
 assert.equal(result.meta.creditsCharged,0);assert.equal(calls,1);
 assert.deepEqual(receipts.map(r=>r.status),['STARTED','COMPLETED']);
 assert.deepEqual(receipts[1].meta.targetCountries,EXPLEE_TARGET_COUNTRIES);
});

test('Explee permission, balance and quota failures never retry or look like results',async t=>{
 const saved=globalThis.fetch;t.after(()=>{globalThis.fetch=saved;});
 for(const status of [402,403,429]){
  let calls=0;const receipts=[];
  globalThis.fetch=async()=>{calls++;return Response.json({detail:status===403?'project scope denied':'provider refusal'}, {status});};
  const env={LEO_PLATFORM_TOKEN:'synthetic-owner-token-never-production',EXPLEE_API_KEY:'synthetic-token',COMMERCE:{get:async()=>null,put:async(k,v)=>receipts.push(JSON.parse(v))}};
  const response=await worker.fetch(new Request('https://boltech-group.pages.dev/api/leo-integrations',{method:'POST',headers:{Authorization:'Bearer '+env.LEO_PLATFORM_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({action:'search',platform:'explee',query:'import distributors'})}),env);
  const result=await response.json();assert.equal(result.success,false);assert.equal(result.error,'PROVIDER_HTTP_'+status);
  assert.equal(calls,1);assert.equal(receipts.at(-1).status,'FAILED');assert.equal(result.items,undefined);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {expleeAccountCheck} from '../cloudflare/leo-provider-diagnostics.mjs';
import worker from '../cloudflare/pages-leo-audio-worker.mjs';
const secret='qa-only-explee-account-read-secret';
const account=remain=>({organization:{id:'qa-private-org',name:'Do not expose'},key:{read_only:true,project_ids:['qa-private-project']},balance:{remain},plan:'private-plan'});
const json=(value,status=200,headers={})=>Response.json(value,{status,headers});
test('Explee check calls only official free account GET and returns no account details',async()=>{
 let calls=0;
 const result=await expleeAccountCheck({EXPLEE_API_KEY:secret},async(url,options)=>{calls++;assert.equal(url,'https://api.explee.com/public/api/v1/me');assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.headers['X-API-Key'],secret);assert.equal(options.body,undefined);return json(account(50));});
 assert.equal(calls,1);assert.equal(result.status,'CONNECTED');assert.equal(result.accountCheck,'GET_ME');assert.equal(result.searchReadiness,'POSITIVE_BALANCE_NOT_SEARCH_VERIFIED');
 for(const value of [secret,'qa-private-org','qa-private-project','private-plan','Do not expose'])assert.ok(!JSON.stringify(result).includes(value));
});
test('zero credit balance is authenticated, not certified as search-ready',async()=>{
 for(const remain of [0,-2]){const result=await expleeAccountCheck({EXPLEE_API_KEY:secret},async()=>json(account(remain)));assert.equal(result.status,'CONNECTED');assert.equal(result.searchReadiness,'POSITIVE_BALANCE_REQUIRED');}
});
test('401, restricted key, restricted IP, edge challenge and unknown 403 remain distinct without provider text',async()=>{
 const cases=[
  [json({detail:'Invalid API key'},401),'API_KEY_REJECTED'],
  [json({code:'insufficient_scope'},403),'API_SCOPE_DENIED'],
  [json({code:'ip_not_allowed'},403),'IP_RESTRICTED'],
  [new Response('<html>Cloudflare challenge</html>',{status:403,headers:{'Content-Type':'text/html','cf-mitigated':'challenge'}}),'EDGE_ACCESS_DENIED'],
  [json({detail:'Unknown provider message '+secret},403),'ACCESS_DENIED_UNCLASSIFIED'],
  [json({},429),'RATE_LIMITED']
 ];
 for(const [response,reason]of cases)await assert.rejects(expleeAccountCheck({EXPLEE_API_KEY:secret},async()=>response),error=>{assert.equal(error.providerReason,reason);assert.ok(!error.message.includes(secret));return true;});
});
test('invalid or absent credentials, malformed account bodies and oversized responses never pass',async()=>{
 await assert.rejects(expleeAccountCheck({},()=>assert.fail('no network')),{message:'PROVIDER_SECRET_MISSING'});
 for(const body of [{},{...account(1),balance:{remain:'1'}},{...account(1),organization:{}},{...account(1),key:[]}])await assert.rejects(expleeAccountCheck({EXPLEE_API_KEY:secret},async()=>json(body)),{message:'PROVIDER_RESPONSE_INVALID'});
 await assert.rejects(expleeAccountCheck({EXPLEE_API_KEY:secret},async()=>new Response('x'.repeat(33000))),{message:'PROVIDER_RESPONSE_INVALID'});
});
test('live Worker routing uses the account GET and retains owner authorization',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.explee.com/public/api/v1/me');assert.equal(options.method,'GET');return json(account(0));};
 const env={EXPLEE_API_KEY:secret,LEO_PLATFORM_TOKEN:'qa-only-owner-private-diagnostic-token'};
 const request=authorized=>new Request('https://boltech-group.pages.dev/api/leo-integrations',{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer '+env.LEO_PLATFORM_TOKEN}:{})},body:JSON.stringify({action:'check',platform:'explee'})});
 assert.equal((await worker.fetch(request(false),env)).status,401);assert.equal(calls,0);
 const result=await(await worker.fetch(request(true),env)).json();assert.equal(result.accountCheck,'GET_ME');assert.equal(calls,1);
});

test('schema mismatch exposes only fixed field types, never provider values or arbitrary field names',async()=>{
 const body={organization:{id:777,name:secret},balance:{remain:12},key:{read_only:true},[secret]:secret};
 await assert.rejects(expleeAccountCheck({EXPLEE_API_KEY:secret},async()=>json(body)),error=>{assert.equal(error.providerReason,'ACCOUNT_SCHEMA_MISMATCH');assert.equal(error.providerHttpStatus,200);assert.equal(error.accountShape.organizationId,'number');assert.ok(!JSON.stringify(error.accountShape).includes(secret));assert.ok(!JSON.stringify(error.accountShape).includes('777'));return true;});
});

test('observed Explee null or omitted balance authenticates without guessing funds or search availability',async()=>{
 for(const balance of [null,undefined]){
  const result=await expleeAccountCheck({EXPLEE_API_KEY:secret},async()=>json({...account(10),balance}));
  assert.equal(result.status,'CONNECTED');assert.equal(result.searchReadiness,'BALANCE_NOT_REPORTED');assert.equal(result.accountCheck,'GET_ME');assert.ok(!('balance' in result));
 }
});

test('a 200 error envelope cannot pass even if account-like fields exist',async()=>{
 for(const extra of [{success:false},{status:'error'},{error:{private:secret}}])await assert.rejects(expleeAccountCheck({EXPLEE_API_KEY:secret},async()=>json({...account(1),...extra})),{message:'PROVIDER_REJECTED'});
});

test('account scope hints are booleans only, without project identifiers',async()=>{
 const result=await expleeAccountCheck({EXPLEE_API_KEY:secret},async()=>json({...account(0),key:{read_only:true,project_ids:[secret]}}));
 assert.equal(result.keyReadOnly,true);assert.equal(result.projectRestricted,true);assert.ok(!JSON.stringify(result).includes(secret));
 const unknown=await expleeAccountCheck({EXPLEE_API_KEY:secret},async()=>json({...account(0),key:{read_only:secret,project_ids:secret}}));assert.equal(unknown.keyReadOnly,undefined);assert.equal(unknown.projectRestricted,undefined);
});

test('company search identifies an explicit project-scope denial without returning provider text',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async(url)=>{assert.equal(url,'https://api.explee.com/public/api/v1/search/companies');return json({detail:'API key restricted to projects '+secret},403);};
 const env={EXPLEE_API_KEY:secret,LEO_PLATFORM_TOKEN:'qa-private-owner-diagnostic-scope-token',COMMERCE:{get:async()=>null,put:async()=>{}}};
 const request=new Request('https://boltech-group.pages.dev/api/leo-integrations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.LEO_PLATFORM_TOKEN},body:JSON.stringify({action:'search',platform:'explee',query:'clinics in El Salvador'})});
 const response=await worker.fetch(request,env);const data=await response.json();assert.equal(data.error,'PROVIDER_HTTP_403');assert.equal(data.providerReason,'API_SCOPE_DENIED');assert.ok(!JSON.stringify(data).includes(secret));
});

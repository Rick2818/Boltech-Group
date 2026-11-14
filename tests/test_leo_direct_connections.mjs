// Isolated contract tests; provider responses here are synthetic, never live evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import worker from '../cloudflare/leo-connections/_worker.js';
import {handleUpworkOAuth,getUpworkToken,upworkConfiguration} from '../cloudflare/leo-connections/upwork-oauth.mjs';
import {upworkRead} from '../cloudflare/leo-connections/upwork.mjs';
const origin='https://boltech-group.pages.dev';
const secret='synthetic-owner-token-for-tests-32';
function envFixture(){const values=new Map();return {values,LEO_PLATFORM_TOKEN:secret,UPWORK_ORG_UID:'synthetic-org',
 COMMERCE:{get:async k=>values.get(k),put:async(k,v)=>{values.set(k,v);}}};}
const authorize=req=>req.headers.get('Authorization')==='Bearer '+secret;
const startRequest=()=>new Request(origin+'/api/upwork/start',{method:'POST',headers:{Authorization:'Bearer '+secret,Origin:origin}});
async function begin(env){const r=await handleUpworkOAuth(startRequest(),env,authorize);return {url:new URL((await r.json()).authorizationUrl),cookie:r.headers.get('set-cookie').split(';')[0]};}
function callback(flow,extra=''){return new Request(origin+'/api/upwork/callback?code=synthetic-code&state='+flow.url.searchParams.get('state')+extra,{headers:{Cookie:flow.cookie}});}
const goodToken=()=>Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',token_type:'Bearer',expires_in:3600});
async function linked(){const env=envFixture();const flow=await begin(env);assert.equal((await handleUpworkOAuth(callback(flow),env,authorize,async()=>goodToken())).status,200);return env;}
test('direct client metadata points only to Cloudflare and advertises a public PKCE client',async()=>{
 const r=await handleUpworkOAuth(new Request(origin+'/api/upwork/client-metadata'),{},authorize);const data=await r.json();
 assert.equal(data.client_id,origin+'/api/upwork/client-metadata');assert.deepEqual(data.redirect_uris,[origin+'/api/upwork/callback']);assert.equal(data.token_endpoint_auth_method,'none');
 assert.doesNotMatch(JSON.stringify(data),/vercel/i);
});
test('start requires owner authorization and rejects cross-origin access',async()=>{
 const env=envFixture();assert.equal((await handleUpworkOAuth(new Request(origin+'/api/upwork/start',{method:'POST'}),env,authorize)).status,401);
 const bad=new Request(origin+'/api/upwork/start',{method:'POST',headers:{Authorization:'Bearer '+secret,Origin:'https://untrusted.invalid'}});
 assert.equal((await handleUpworkOAuth(bad,env,authorize)).status,403);
});
test('PKCE exchange is browser-bound; token material is encrypted in persistent storage',async()=>{
 const env=envFixture();const flow=await begin(env);const params=flow.url.searchParams;
 assert.equal(params.get('code_challenge_method'),'S256');assert.equal(params.get('resource'),'https://mcp.upwork.com/mcp');
 let calls=0;
 const fetchFn=async(url,options)=>{calls++;assert.equal(url,'https://www.upwork.com/api/v3/oauth2/token');
 assert.equal(options.redirect,'manual');assert.equal(options.body.get('client_secret'),null);
 const verifier=options.body.get('code_verifier');const challenge=createHash('sha256').update(verifier).digest('base64url');
 assert.equal(challenge,params.get('code_challenge'));assert.equal(options.body.get('redirect_uri'),origin+'/api/upwork/callback');return goodToken();};
 const result=await handleUpworkOAuth(callback(flow),env,authorize,fetchFn);assert.equal(result.status,200);assert.equal(calls,1);
 assert.doesNotMatch(await result.text(),/synthetic-access|synthetic-refresh/);
 assert.doesNotMatch([...env.values.values()].join(''),/synthetic-access|synthetic-refresh/);
 assert.equal(await getUpworkToken(env),'synthetic-access');assert.equal((await upworkConfiguration(env)).authorized,true);
});
test('missing, duplicated, tampered and mismatched state cannot call the provider',async()=>{
 const env=envFixture();const flow=await begin(env);let calls=0;const fetchFn=async()=>{calls++;return goodToken();};
 const requests=[new Request(callback(flow).url),callback(flow,'&state=duplicate'),new Request(callback(flow).url,{headers:{Cookie:flow.cookie+'tampered'}}),new Request(origin+'/api/upwork/callback?code=x&state=wrong',{headers:{Cookie:flow.cookie}})];
 for(const request of requests)assert.equal((await handleUpworkOAuth(request,env,authorize,fetchFn)).status,400);
 assert.equal(calls,0);assert.equal(env.values.size,0);
});
test('provider rejection does not persist fabricated tokens or expose provider text',async()=>{
 const env=envFixture();const flow=await begin(env);
 const response=await handleUpworkOAuth(callback(flow),env,authorize,async()=>new Response('secret-provider-diagnostic',{status:401}));
 assert.equal(response.status,400);assert.equal(env.values.size,0);assert.doesNotMatch(await response.text(),/secret-provider-diagnostic/);
});
test('near-expiry tokens refresh directly at Upwork and remain encrypted',async t=>{
 const env=envFixture();const flow=await begin(env);
 await handleUpworkOAuth(callback(flow),env,authorize,async()=>Response.json({access_token:'old-access',refresh_token:'refresh-one',token_type:'Bearer',expires_in:1}));
 const token=await getUpworkToken(env,async(url,options)=>{assert.equal(url,'https://www.upwork.com/api/v3/oauth2/token');assert.equal(options.body.get('grant_type'),'refresh_token');assert.equal(options.body.get('refresh_token'),'refresh-one');return goodToken();});
 assert.equal(token,'synthetic-access');assert.doesNotMatch([...env.values.values()].join(''),/synthetic-access|refresh-one/);
});
test('MCP handshake accepts JSON and streaming SSE without waiting for stream closure',async()=>{
 for(const sse of [false,true]){
  const env=await linked();const calls=[];
  const fetchFn=async(url,options)=>{
   assert.equal(url,'https://mcp.upwork.com/mcp');assert.equal(options.headers.Authorization,'Bearer synthetic-access');
   const body=JSON.parse(options.body);calls.push(body);
   if(body.method==='notifications/initialized')return new Response(null,{status:202});
   const result=body.method==='initialize'?{protocolVersion:'2025-03-26'}:{structuredContent:{success:true,user:{id:'synthetic-user'}}};
   if(body.method==='tools/call'){assert.equal(options.headers['Mcp-Session-Id'],'synthetic-session');assert.equal(body.params.name,'get_account');assert.equal(body.params.arguments.action,'get_user_details');assert.equal(body.params.arguments.org_uid,'synthetic-org');}
   const text=JSON.stringify({jsonrpc:'2.0',id:body.id,result});
   if(!sse)return Response.json(JSON.parse(text),{headers:{'Mcp-Session-Id':'synthetic-session'}});
   return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: '+text+'\n\n'));}}),{headers:{'Content-Type':'text/event-stream','Mcp-Session-Id':'synthetic-session'}});
  };
  assert.equal((await upworkRead(env,'check',undefined,fetchFn)).status,'CONNECTED');assert.equal(calls.length,3);
 }
});
test('only fixed read operations can reach Upwork; missing authorization fails closed',async()=>{
 let calls=0;const fetchFn=async()=>{calls++;return goodToken();};
 await assert.rejects(upworkRead(envFixture(),'send_message','x',fetchFn),/UPWORK_ACTION_NOT_ALLOWED/);
 await assert.rejects(upworkRead(envFixture(),'search','a',fetchFn),/INVALID_QUERY/);
 await assert.rejects(upworkRead(envFixture(),'check',undefined,fetchFn),/UPWORK_AUTHORIZATION_REQUIRED/);assert.equal(calls,0);
});
test('job search is bounded to ten newest results and returns provider URLs',async()=>{
 const env=await linked();
 const fetchFn=async(url,options)=>{const body=JSON.parse(options.body);
 if(body.method==='notifications/initialized')return new Response(null,{status:202});
 if(body.method==='initialize')return Response.json({jsonrpc:'2.0',id:body.id,result:{protocolVersion:'2025-03-26'}});
 assert.equal(body.params.name,'find_jobs');assert.deepEqual(body.params.arguments.params,{query:'automation',limit:10,sort:'recency'});
 return Response.json({jsonrpc:'2.0',id:body.id,result:{structuredContent:{jobs:[{id:'test-job',title:'Test title',url:'https://www.upwork.com/jobs/test-job'}]}}});};
 const result=await upworkRead(env,'search','automation',fetchFn);assert.equal(result.items[0].id,'test-job');assert.equal(result.items[0].url,'https://www.upwork.com/jobs/test-job');
});
test('Upwork HTTP-200 tool errors are failures rather than connected status',async()=>{
 const env=await linked();
 const fetchFn=async(url,options)=>{const b=JSON.parse(options.body);if(!b.id)return new Response(null,{status:202});return Response.json({jsonrpc:'2.0',id:b.id,result:b.method==='initialize'?{protocolVersion:'2025-03-26'}:{isError:true,content:[{type:'text',text:'secret'}]}});};
 await assert.rejects(upworkRead(env,'check',undefined,fetchFn),/UPWORK_TOOL_REJECTED/);
});
test('integration status lists all providers without exposing stored credentials',async()=>{
 const env={...envFixture(),FREELANCER_OAUTH_TOKEN:'synthetic-freelancer',FREELANCER_API_ENABLED:'true',EXPLEE_API_KEY:'synthetic-explee'};
 const request=new Request(origin+'/api/leo-integrations',{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify({action:'status'})});
 const result=await worker.fetch(request,env);const text=await result.text();const data=JSON.parse(text);
 assert.ok(data.freelancer.configured&&data.explee.configured&&data.upwork.configured);assert.equal(data.upwork.authorized,false);assert.doesNotMatch(text,/synthetic-(freelancer|explee|owner)/);
});
test('Explee rejection is classified without returning private provider response text',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('<html>Cloudflare challenge secret-provider-body</html>',{status:403}));
 const env={...envFixture(),EXPLEE_API_KEY:'synthetic-explee'};
 const request=new Request(origin+'/api/leo-integrations',{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify({action:'check',platform:'explee'})});
 const result=await worker.fetch(request,env);const data=await result.json();assert.equal(data.error,'PROVIDER_HTTP_403');assert.equal(data.providerReason,'EDGE_ACCESS_DENIED');assert.doesNotMatch(JSON.stringify(data),/secret-provider-body|synthetic-explee/);
});
test('voice implementation and payment forwarding match the approved published package byte for byte',()=>{
 const source=readFileSync(new URL('../cloudflare/leo-connections/_worker.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../cloudflare/leo-connections/sales-agent.html',import.meta.url),'utf8');
 const hash=s=>createHash('sha256').update(s).digest('hex');
 assert.equal(hash(source.slice(source.indexOf('async function speech('),source.indexOf('// Only a first, greeting-only'))),'09bee548a24eb3ce65fb26fad0206e375853b140806af2972740150037a88e21');
 assert.equal(hash(source.slice(source.indexOf('    // Never resolve user-controlled paths'))),'70669e93ede3296ae7e8827efb62dd98aaec52a77b0ab916ca512084666c27a1');
 assert.equal(hash(html.slice(html.indexOf('<script type="module">'),html.indexOf('async function integrationRequest('))),'4c95d17faf2cf646d6ed6046c0bc30a279d76fdb4b6dd62fbc677e791542b6a4');
});
test('Cloudflare routes OAuth metadata locally instead of forwarding it to the old backend',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('must not forward');});
 const response=await worker.fetch(new Request(origin+'/api/upwork/client-metadata'),{});
 assert.equal(response.status,200);assert.equal((await response.json()).client_id,origin+'/api/upwork/client-metadata');assert.equal(calls,0);
});
test('expired browser authorization state cannot call the provider',async t=>{
 const env=envFixture();const flow=await begin(env);const now=Date.now();t.mock.method(Date,'now',()=>now+601000);
 let calls=0;const response=await handleUpworkOAuth(callback(flow),env,authorize,async()=>{calls++;return goodToken();});
 assert.equal(response.status,400);assert.equal(calls,0);
});
test('Upwork storage outage does not break Freelancer and Explee configuration status',async()=>{
 const env={...envFixture(),FREELANCER_OAUTH_TOKEN:'synthetic-freelancer',EXPLEE_API_KEY:'synthetic-explee',COMMERCE:{get:async()=>{throw Error('private-storage-detail');},put:async()=>{}}};
 const response=await worker.fetch(new Request(origin+'/api/leo-integrations',{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify({action:'status'})}),env);
 const data=await response.json();assert.equal(data.success,true);assert.equal(data.upwork.configured,false);assert.ok(data.freelancer.configured&&data.explee.configured);assert.doesNotMatch(JSON.stringify(data),/private-storage-detail/);
});

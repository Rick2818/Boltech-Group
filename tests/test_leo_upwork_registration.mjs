import test from 'node:test';
import assert from 'node:assert/strict';
import {handleUpworkOAuth,getUpworkToken} from '../cloudflare/pages-leo-audio-worker.mjs';

// Isolated provider fixtures only; these tests do not register live clients.
const origin='https://boltech-group.pages.dev';
const callback=origin+'/api/upwork/callback';
const client={client_id:'qa-issued-by-upwork',redirect_uris:[callback],token_endpoint_auth_method:'none'};
function fixture() {
  const values=new Map();
  const env={LEO_PLATFORM_TOKEN:'qa-only-upwork-owner-secret-00000',COMMERCE:{get:async k=>values.get(k)||null,put:async(k,v)=>values.set(k,v)}};
  const start=(fetchFn,authorize=()=>true)=>handleUpworkOAuth(new Request(origin+'/api/upwork/start',{method:'POST',headers:{Origin:origin}}),env,authorize,fetchFn);
  return {env,values,start};
}

test('registers the exact Cloudflare callback and uses only the returned ID; caches registration',async()=>{
  const {start,values}=fixture();let calls=0;
  const provider=async(url,init)=>{
    calls++;assert.equal(url,'https://www.upwork.com/register');assert.equal(init.method,'POST');assert.equal(init.redirect,'manual');
    const body=JSON.parse(init.body);assert.deepEqual(body.redirect_uris,[callback]);assert.equal(body.token_endpoint_auth_method,'none');
    assert.equal(body.client_id,undefined);
    return Response.json(client,{status:201});
  };
  for(let i=0;i<2;i++) {
    const result=await start(provider);assert.equal(result.status,200);
    const url=new URL((await result.json()).authorizationUrl);
    assert.equal(url.searchParams.get('client_id'),client.client_id);
    assert.equal(url.searchParams.get('redirect_uri'),callback);
    assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    assert.equal(url.searchParams.get('resource'),'https://mcp.upwork.com/mcp');
    assert.match(result.headers.get('Set-Cookie'),/HttpOnly; SameSite=Lax/);
  }
  assert.equal(calls,1);assert.equal(values.size,1);
});

test('registration rejection or outage returns no login URL or OAuth cookie and stores nothing',async()=>{
  for(const status of [400,401,403,302,429,500]) {
    const {start,values}=fixture();let calls=0;
    const response=await start(async()=>{calls++;return new Response('private provider details',{status});});
    assert.equal(response.status,[400,401,403].includes(status)?403:503);
    const data=await response.json();assert.equal(data.success,false);
    assert.equal(data.error,[400,401,403].includes(status)?'UPWORK_CLIENT_REGISTRATION_DENIED':'UPWORK_CLIENT_REGISTRATION_UNAVAILABLE');
    assert.equal(data.authorizationUrl,undefined);assert.equal(response.headers.get('Set-Cookie'),null);assert.equal(values.size,0);assert.equal(calls,1);
    assert.doesNotMatch(JSON.stringify(data),/private provider details/);
  }
  const {start}=fixture();
  const data=await (await start(async()=>{throw Error('private network detail');})).json();
  assert.equal(data.error,'UPWORK_CLIENT_REGISTRATION_UNAVAILABLE');
});

test('rejects malformed clients, another callback, unsupported auth, and the old invented identifier',async()=>{
  const invalid=[{}, {...client,client_id:''},{...client,client_id:'bad\nclient'},
    {...client,client_id:origin+'/api/upwork/client-metadata'},
    {...client,redirect_uris:['https://attacker.example/callback']},
    {...client,redirect_uris:[callback,'http://localhost:1234']},
    {...client,token_endpoint_auth_method:'client_secret_basic'}];
  for(const data of invalid) {
    const {start,values}=fixture();
    const result=await start(async()=>Response.json(data,{status:201}));
    assert.equal((await result.json()).error,'UPWORK_CLIENT_REGISTRATION_INVALID');assert.equal(values.size,0);
  }
});

test('unauthorized and cross-origin callers cannot cause a registration',async()=>{
  const {start,env}=fixture();let calls=0;
  const provider=async()=>{calls++;throw Error('must not call provider');};
  assert.equal((await start(provider,()=>false)).status,401);
  const request=new Request(origin+'/api/upwork/start',{method:'POST',headers:{Origin:'https://attacker.example'}});
  assert.equal((await handleUpworkOAuth(request,env,()=>true,provider)).status,403);
  assert.equal(calls,0);
});

test('code exchange and refresh retain the issued client, PKCE, encrypted storage and callback binding',async()=>{
  const {start,env,values}=fixture();let tokenCalls=0;
  const provider=async(url,init)=>{
    if(url==='https://www.upwork.com/register')return Response.json(client,{status:201});
    assert.equal(url,'https://www.upwork.com/api/v3/oauth2/token');assert.equal(init.redirect,'manual');
    const params=new URLSearchParams(init.body);assert.equal(params.get('client_id'),client.client_id);
    tokenCalls++;
    if(params.get('grant_type')==='authorization_code') {
      assert.equal(params.get('code'),'qa-code');assert.equal(params.get('redirect_uri'),callback);assert.match(params.get('code_verifier'),/^[\w-]{43}$/);
      return Response.json({access_token:'qa-access',refresh_token:'qa-refresh',token_type:'Bearer',expires_in:1});
    }
    assert.equal(params.get('grant_type'),'refresh_token');assert.equal(params.get('refresh_token'),'qa-refresh');
    return Response.json({access_token:'qa-new-access',token_type:'Bearer',expires_in:3600});
  };
  const opened=await start(provider);const auth=new URL((await opened.json()).authorizationUrl);
  const Cookie=opened.headers.get('Set-Cookie').split(';')[0];
  const request=new Request(callback+'?code=qa-code&state='+auth.searchParams.get('state'),{headers:{Cookie}});
  const result=await handleUpworkOAuth(request,env,()=>false,provider);assert.equal(result.status,200);
  assert.equal(await getUpworkToken(env,provider),'qa-new-access');assert.equal(tokenCalls,2);
  assert.doesNotMatch(JSON.stringify([...values]),/qa-access|qa-refresh|qa-new-access/);
  assert.equal(await getUpworkToken(env,provider),'qa-new-access');assert.equal(tokenCalls,2);
});

test('changing the registered client during login invalidates the callback before exchanging a code',async()=>{
  const {start,env,values}=fixture();
  const opened=await start(async()=>Response.json(client,{status:201}));
  const auth=new URL((await opened.json()).authorizationUrl);const Cookie=opened.headers.get('Set-Cookie').split(';')[0];
  values.set('leo:upwork:client:v1',JSON.stringify({...client,client_id:'qa-different-client'}));
  let calls=0;
  const result=await handleUpworkOAuth(new Request(callback+'?code=qa-code&state='+auth.searchParams.get('state'),{headers:{Cookie}}),env,()=>true,async()=>{calls++;});
  assert.equal((await result.json()).error,'UPWORK_AUTH_STATE_INVALID');assert.equal(calls,0);
});

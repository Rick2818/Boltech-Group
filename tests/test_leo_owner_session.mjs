import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/pages-leo-audio-worker.mjs';
import {OWNER_COOKIE, OWNER_SESSION_SECONDS} from '../cloudflare/leo-owner-session.mjs';

const origin='https://boltech-group.pages.dev';
const secret='qa-only-owner-key-not-a-live-secret';
function fixture() {
  const records=new Map();
  const env={LEO_PLATFORM_TOKEN:secret, COMMERCE:{
    get:async key=>records.get(key)||null,
    put:async (key,value)=>records.set(key,value)
  }};
  const send=(path,method='GET',headers={},body)=>worker.fetch(new Request(origin+path,{method,headers,body}),env);
  const login=async cookie=>send('/api/leo-owner-session','POST',{Origin:origin,Authorization:'Bearer '+secret,...(cookie?{Cookie:cookie}:{})});
  return {env,records,send,login};
}
const cookieFrom=response=>response.headers.get('Set-Cookie').split(';')[0];

test('one login yields an opaque, persistent HttpOnly host cookie and restores after page reload',async()=>{
  const {send,login,records}=fixture();
  const before=await send('/api/leo-owner-session');
  assert.equal((await before.json()).authenticated,false);
  const response=await login();assert.equal(response.status,200);
  const header=response.headers.get('Set-Cookie');
  assert.match(header,new RegExp('^'+OWNER_COOKIE+'=[a-f0-9]{64};'));
  for(const flag of ['Path=/','Secure','HttpOnly','SameSite=Strict','Max-Age='+OWNER_SESSION_SECONDS])assert.ok(header.includes(flag));
  assert.ok(!header.includes(secret));assert.ok(!header.includes('Domain='));
  const body=await response.json();assert.equal(body.authenticated,true);
  assert.ok(!JSON.stringify(body).includes(secret));assert.ok(!JSON.stringify([...records]).includes(secret));
  const restored=await send('/api/leo-owner-session','GET',{Cookie:cookieFrom(response)});
  assert.equal((await restored.json()).authenticated,true);
  assert.equal(restored.headers.get('Cache-Control'),'no-store');
});

test('cookie authorizes integration status and Upwork start without a Bearer header',async()=>{
  const {send,login}=fixture();const Cookie=cookieFrom(await login());
  const status=await send('/api/leo-integrations','POST',{Cookie,Origin:origin},JSON.stringify({action:'status'}));
  assert.equal(status.status,200);assert.equal((await status.json()).success,true);
  const saved=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.equal(String(url),'https://www.upwork.com/register');
    return Response.json({client_id:'qa-upwork-issued-client',redirect_uris:[origin+'/api/upwork/callback'],token_endpoint_auth_method:'none'},{status:201});
  };
  try {
    const upwork=await send('/api/upwork/start','POST',{Cookie,Origin:origin});
    assert.equal(upwork.status,200);
    assert.equal(new URL((await upwork.json()).authorizationUrl).hostname,'www.upwork.com');
  }finally{globalThis.fetch=saved;}
});

test('wrong keys, missing keys and cross-origin login cannot create sessions',async()=>{
  const {send,records}=fixture();
  for(const headers of [
    {Origin:origin}, {Origin:origin,Authorization:'Bearer wrong'},
    {Origin:'https://attacker.example',Authorization:'Bearer '+secret},
    {Authorization:'Bearer '+secret},
    {Origin:origin,'Sec-Fetch-Site':'same-site',Authorization:'Bearer '+secret}
  ]) {
    const response=await send('/api/leo-owner-session','POST',headers);
    assert.ok([401,403].includes(response.status));assert.equal(response.headers.get('Set-Cookie'),null);
  }
  assert.equal(records.size,0);
});

test('cookie requests require exact Origin for private reads, OAuth start and logout',async()=>{
  const {send,login}=fixture();const Cookie=cookieFrom(await login());
  for(const Origin of [undefined,'null','https://attacker.example','https://other.boltech-group.pages.dev']) {
    const headers={Cookie,...(Origin?{Origin}:{})};
    for(const [path,method,body]of [
      ['/api/leo-integrations','POST',JSON.stringify({action:'status'})],
      ['/api/upwork/start','POST'],['/api/leo-owner-session','DELETE']
    ])assert.equal((await send(path,method,headers,body)).status,403);
  }
  assert.equal((await (await send('/api/leo-owner-session','GET',{Cookie})).json()).authenticated,true);
});

test('logout clears browser cookie and revokes a saved copy in the session store',async()=>{
  const {send,login}=fixture();const Cookie=cookieFrom(await login());
  const response=await send('/api/leo-owner-session','DELETE',{Cookie,Origin:origin});
  assert.equal(response.status,200);assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);
  assert.equal((await (await send('/api/leo-owner-session','GET',{Cookie})).json()).authenticated,false);
  assert.equal((await send('/api/leo-integrations','POST',{Cookie,Origin:origin},JSON.stringify({action:'status'}))).status,401);
});

test('forged and duplicate cookies, expired sessions, changed owner key and wrong host fail closed',async()=>{
  for(const variant of ['forged','duplicate','expired','rotated','origin','corrupt']) {
    const {send,login,records,env}=fixture();let Cookie=cookieFrom(await login());
    if(variant==='forged')Cookie=OWNER_COOKIE+'='+'a'.repeat(64);
    if(variant==='duplicate')Cookie+='; '+Cookie;
    if(variant==='rotated')env.LEO_PLATFORM_TOKEN=secret+'changed';
    if(['expired','origin','corrupt'].includes(variant))for(const [key,raw]of records){
      const record=JSON.parse(raw);
      if(variant==='expired'){record.expiresAt=Date.now()-1000;record.createdAt=record.expiresAt-OWNER_SESSION_SECONDS*1000;}
      if(variant==='origin')record.origin='https://other.example';
      records.set(key,variant==='corrupt'?'malformed':JSON.stringify(record));
    }
    assert.equal((await (await send('/api/leo-owner-session','GET',{Cookie})).json()).authenticated,false,variant);
    assert.equal((await send('/api/leo-integrations','POST',{Cookie,Origin:origin},JSON.stringify({action:'status'}))).status,401,variant);
  }
});

test('new login replaces the prior browser session; absent or failed storage never grants access',async()=>{
  const {send,login,env}=fixture();const first=cookieFrom(await login());
  const second=cookieFrom(await login(first));assert.notEqual(first,second);
  assert.equal((await (await send('/api/leo-owner-session','GET',{Cookie:first})).json()).authenticated,false);
  assert.equal((await (await send('/api/leo-owner-session','GET',{Cookie:second})).json()).authenticated,true);
  env.COMMERCE.get=async()=>{throw Error('private-storage-error');};
  let response=await send('/api/leo-owner-session','GET',{Cookie:second});assert.equal(response.status,503);
  assert.ok(!(await response.text()).includes('private-storage-error'));
  response=await send('/api/leo-integrations','POST',{Cookie:second,Origin:origin},JSON.stringify({action:'status'}));assert.equal(response.status,503);
  env.COMMERCE={};assert.equal((await login()).status,503);
});

test('the owner session cookie never reaches the immutable backend; payment bytes and other cookies survive',async()=>{
  const {send}=fixture();const saved=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert.equal(new URL(url).hostname,'e912df66.boltech-group.pages.dev');
    assert.equal(options.headers.get('Cookie'),'customer=preserved');
    assert.equal(await new Response(options.body).text(),'signed-payment-body');
    return new Response('preserved');
  };
  try{assert.equal(await (await send('/api/payments','POST',{Cookie:'customer=preserved; '+OWNER_COOKIE+'='+'a'.repeat(64)},'signed-payment-body')).text(),'preserved');}
  finally{globalThis.fetch=saved;}
});

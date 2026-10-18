import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createUpworkOAuthHandler, decryptUpworkTokens, UPWORK_CALLBACK_URL, UPWORK_TOKEN_KEY } from '../lib/upwork_oauth.js';

function fixture(options={}) {
  const records=new Map(), calls=[];
  const redis={async get(k){return records.get(k)||null;},async set(k,v,opts={}){if(opts.nx&&records.has(k))return null; records.set(k,v);return 'OK';},async getdel(k){const v=records.get(k)||null;records.delete(k);return v;}};
  const config={UPWORK_CLIENT_ID:'test-client-id',UPWORK_CLIENT_SECRET:'test-client-secret'};
  const handler=createUpworkOAuthHandler({getRedis:()=>redis,requireAuth(req,res){if(req.headers.authorization==='Bearer test-admin')return true;res.status(401).json({success:false,code:'OPERATIONAL_AUTH_REQUIRED'});return false;},env:()=>config,now:()=>1000000,fetchFn:async(...args)=>{calls.push(args);return {ok:true,json:async()=>({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,token_type:'bearer'})};},...options});
  async function invoke(action='callback',url='/api/upwork/callback',method='GET',headers={}) {
    const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(body){this.body=body;return this;}};
    await handler({url,method,headers},res,action);return res;
  }
  async function start() {
    const result=await invoke('start','/api/upwork/authorize','POST',{authorization:'Bearer test-admin'});
    assert.equal(result.statusCode,200);
    return {result,state:new URL(result.body.authorizationUrl).searchParams.get('state'),cookie:result.headers['Set-Cookie'].split(';')[0]};
  }
  return {records,calls,redis,config,invoke,start};
}
test('public callback readiness does not claim agent connection or require secrets',async()=>{
 const f=fixture({env:()=>({})}),r=await f.invoke();
 assert.equal(r.statusCode,200);assert.equal(r.body.code,'UPWORK_CALLBACK_READY');assert.equal(r.body.credentialsConfigured,false);assert.equal(r.body.agent1Connected,false);assert.equal(f.calls.length,0);assert.equal(r.headers['Referrer-Policy'],'no-referrer');
});
test('start requires POST and existing operational auth before any state is written',async()=>{
 const f=fixture();assert.equal((await f.invoke('start')).statusCode,405);assert.equal((await f.invoke('start','/api/upwork/authorize','POST')).statusCode,401);assert.equal(f.records.size,0);
});
test('missing credentials or durable Redis stops OAuth',async()=>{
 assert.equal((await fixture({env:()=>({})}).invoke('start','/api/upwork/authorize','POST',{authorization:'Bearer test-admin'})).body.code,'UPWORK_CLIENT_CREDENTIALS_MISSING');
 assert.equal((await fixture({getRedis:()=>null}).invoke('start','/api/upwork/authorize','POST',{authorization:'Bearer test-admin'})).body.code,'UPWORK_DURABLE_STORE_REQUIRED');
});
test('start fixes provider and callback, bounds state and adds secure browser binding',async()=>{
 const f=fixture(),s=await f.start(),u=new URL(s.result.body.authorizationUrl);
 assert.equal(u.origin,'https://www.upwork.com');assert.equal(u.pathname,'/ab/account-security/oauth2/authorize');assert.equal(u.searchParams.get('redirect_uri'),UPWORK_CALLBACK_URL);assert.equal(u.searchParams.get('response_type'),'code');assert.equal(s.state.length,43);assert.match(s.result.headers['Set-Cookie'],/Secure; HttpOnly; SameSite=Lax; Max-Age=600/);assert.equal(JSON.stringify(s.result.body).includes('test-client-secret'),false);
});
test('missing/wrong binding, missing state and duplicate state never contact provider',async()=>{
 const f=fixture(),s=await f.start();
 for(const [query,headers] of [['?code=x',{}],[`?code=x&state=${s.state}`,{}],[`?code=x&state=${s.state}`,{cookie:'__Host-boltech_upwork_oauth='+'x'.repeat(43)}],[`?code=x&state=${s.state}&state=${s.state}`,{cookie:s.cookie}]]) assert.equal((await f.invoke('callback','/api/upwork/callback'+query,'GET',headers)).statusCode,400);
 assert.equal(f.calls.length,0);assert.equal(f.records.size,1);
});
test('expired state is rejected even if the store returns it',async()=>{
 const f=fixture(),s=await f.start();for(const value of f.records.values())value.issuedAt-=600001;
 assert.equal((await f.invoke('callback',`?state=${s.state}&code=x`,'GET',{cookie:s.cookie})).body.code,'UPWORK_STATE_INVALID');assert.equal(f.calls.length,0);
});
test('provider denial consumes state without exchanging a token',async()=>{
 const f=fixture(),s=await f.start(),r=await f.invoke('callback',`?state=${s.state}&error=access_denied`,'GET',{cookie:s.cookie});
 assert.equal(r.body.code,'UPWORK_AUTHORIZATION_DECLINED');assert.equal(f.calls.length,0);assert.equal(f.records.size,0);
});
test('exchange uses official endpoint, stores authenticated ciphertext and exposes no code/token',async()=>{
 const f=fixture(),s=await f.start(),r=await f.invoke('callback',`?state=${s.state}&code=test-auth-code`,'GET',{cookie:s.cookie});
 assert.equal(r.statusCode,200);assert.equal(r.body.agent1Connected,false);assert.equal(r.body.code,'UPWORK_OAUTH_TOKENS_STORED');
 const [url,opts]=f.calls[0];assert.equal(url,'https://www.upwork.com/api/v3/oauth2/token');assert.equal(opts.redirect,'error');assert.equal(opts.body.get('redirect_uri'),UPWORK_CALLBACK_URL);assert.equal(opts.body.get('code'),'test-auth-code');assert.equal(opts.body.get('client_secret'),'test-client-secret');
 const stored=f.records.get(UPWORK_TOKEN_KEY);assert.equal(JSON.stringify(stored).includes('test-access-token'),false);assert.equal(decryptUpworkTokens(stored,'test-client-secret').refresh_token,'test-refresh-token');assert.throws(()=>decryptUpworkTokens(stored,'wrong-secret'));assert.equal(JSON.stringify(r).includes('test-auth-code'),false);assert.equal(JSON.stringify(r).includes('test-access-token'),false);
});
test('parallel and repeated callbacks exchange at most once',async()=>{
 const f=fixture(),s=await f.start(),invoke=()=>f.invoke('callback',`?state=${s.state}&code=x`,'GET',{cookie:s.cookie});
 const rs=await Promise.all([invoke(),invoke()]);assert.equal(rs.filter(x=>x.statusCode===200).length,1);assert.equal(f.calls.length,1);assert.equal((await invoke()).statusCode,400);
});
test('existing vault blocks another grant and cannot be overwritten',async()=>{
 const f=fixture();f.records.set(UPWORK_TOKEN_KEY,{existing:true});const r=await f.invoke('start','/api/upwork/authorize','POST',{authorization:'Bearer test-admin'});assert.equal(r.statusCode,409);assert.deepEqual(f.records.get(UPWORK_TOKEN_KEY),{existing:true});
});
test('provider errors expose neither tokens nor exception text',async()=>{
 for(const fetchFn of [async()=>{throw Error('secret-transport-detail');},async()=>({ok:false}),async()=>({ok:true,json:async()=>({access_token:'do-not-leak'})}),async()=>({ok:true,json:async()=>{throw Error('private-provider-body');}})]) {
  const f=fixture({fetchFn}),s=await f.start(),r=await f.invoke('callback',`?state=${s.state}&code=x`,'GET',{cookie:s.cookie});assert.equal(r.statusCode,502);assert.equal(f.records.has(UPWORK_TOKEN_KEY),false);assert.doesNotMatch(JSON.stringify(r),/secret-transport|do-not-leak|private-provider/);
 }
});
test('store failures stop without leaking details or using RAM',async()=>{
 const f=fixture({getRedis:()=>({get:async()=>{throw Error('redis-secret');}})});const r=await f.invoke('start','/api/upwork/authorize','POST',{authorization:'Bearer test-admin'});assert.equal(r.statusCode,503);assert.doesNotMatch(JSON.stringify(r),/redis-secret/);
});
test('callback routes reuse index without adding functions or changing payment config',()=>{
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 for(const [path,action] of [['callback','callback'],['authorize','start']]) assert.ok(v.rewrites.some(x=>x.source===`/api/upwork/${path}`&&x.destination===`/api/index?upwork_oauth=${action}`));
 const index=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');assert.match(index,/return await upworkOAuthHandler\(req,res,upworkOAuthAction\)/);assert.match(index,/return await partnersHandler\(req, res\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createSdrGmail, googleOauthDiagnostic} from '../lib/sdr_gmail.js';
const env={GMAIL_OAUTH_CLIENT_ID:'test-client',GMAIL_OAUTH_CLIENT_SECRET:'test-secret',GMAIL_OAUTH_REFRESH_TOKEN:'test-refresh'};
test('simulated access-token expiry renews automatically with the original refresh token',async t=>{
 let now=1000000; t.mock.method(Date,'now',()=>now);
 const exchanges=[],bearers=[];
 const gmail=createSdrGmail(async(url,options)=>{
  if(url.includes('oauth2.googleapis.com')){
   exchanges.push(Object.fromEntries(new URLSearchParams(options.body)));
   return {ok:true,json:async()=>({access_token:'access-'+exchanges.length,expires_in:3600})};
  }
  assert.ok(url.endsWith('/profile'));assert.equal(options.method,undefined);
  bearers.push(options.headers.Authorization);
  return {ok:true,json:async()=>({emailAddress:'ricardo.boltechgroup@gmail.com'})};
 },env);
 await gmail.verify();await gmail.verify();
 assert.equal(exchanges.length,1);
 now+=3600000;await gmail.verify();
 assert.equal(exchanges.length,2);
 assert.deepEqual(bearers,['Bearer access-1','Bearer access-1','Bearer access-2']);
 for(const body of exchanges)assert.deepEqual(body,{grant_type:'refresh_token',client_id:'test-client',client_secret:'test-secret',refresh_token:'test-refresh'});
});
test('revocation after simulated expiry fails closed and a corrected connection recovers',async t=>{
 let now=1000000,exchanges=0,reads=0;t.mock.method(Date,'now',()=>now);t.mock.method(console,'error',()=>{});
 const fetcher=async(url,options)=>{
  if(url.includes('oauth2.googleapis.com')){
   exchanges++;
   if(exchanges===2)return {ok:false,status:400,json:async()=>({error:'invalid_grant'})};
   return {ok:true,json:async()=>({access_token:'synthetic',expires_in:3600})};
  }
  assert.ok(url.endsWith('/profile'));assert.equal(options.method,undefined);reads++;
  return {ok:true,json:async()=>({emailAddress:'ricardo.boltechgroup@gmail.com'})};
 };
 const gmail=createSdrGmail(fetcher,env);await gmail.verify();now+=3600000;
 await assert.rejects(gmail.verify(),e=>e.code==='GMAIL_OAUTH_INVALID_GRANT');
 assert.equal(exchanges,2);assert.equal(reads,1);
 assert.equal((await createSdrGmail(fetcher,{...env,GMAIL_OAUTH_REFRESH_TOKEN:'corrected-refresh'}).verify()).verified,true);
 assert.equal(reads,2);
});
test('Client ID pasted as refresh token is rejected before contacting Google',async()=>{
 let calls=0;
 await assert.rejects(createSdrGmail(async()=>{calls++},{...env,GMAIL_OAUTH_REFRESH_TOKEN:' client.apps.googleusercontent.com\n'}).verify(),e=>e.code==='GMAIL_OAUTH_REFRESH_TOKEN_IS_CLIENT_ID');
 assert.equal(calls,0);
});
test('credential whitespace is normalized without restricting refresh-token prefixes',async()=>{
 const padded=Object.fromEntries(Object.entries(env).map(([k,v])=>[k,' '+v+'\n']));
 const gmail=createSdrGmail(async(url,options)=>{
  if(url.includes('oauth2.googleapis.com')){
   assert.deepEqual(Object.fromEntries(new URLSearchParams(options.body)),{grant_type:'refresh_token',client_id:'test-client',client_secret:'test-secret',refresh_token:'test-refresh'});
   return {ok:true,json:async()=>({access_token:'synthetic',expires_in:3600})};
  }
  return {ok:true,json:async()=>({emailAddress:'ricardo.boltechgroup@gmail.com'})};
 },padded);
 assert.equal((await gmail.verify()).verified,true);
});
for(const [reason,expected] of [['invalid_grant','GMAIL_OAUTH_INVALID_GRANT'],['invalid_client','GMAIL_OAUTH_INVALID_CLIENT'],['unauthorized_client','GMAIL_OAUTH_UNAUTHORIZED_CLIENT'],['something_else','GMAIL_OAUTH_AUTH_FAILED']]){
 test('OAuth error '+reason+' classified without exposing request details',async()=>{
  const fetcher=async()=>({ok:false,status:400,json:async()=>({error:reason,error_description:'Sensitive provider description'})});
  await assert.rejects(()=>createSdrGmail(fetcher,env).verify(),e=>e.code===expected&&!String(e.message).includes('Sensitive'));
 });
}
test('valid refresh and correct Gmail identity are certified',async()=>{
 const fetcher=async url=>url.includes('oauth2.googleapis.com')?{ok:true,json:async()=>({access_token:'synthetic',expires_in:3600})}:{ok:true,json:async()=>({emailAddress:'ricardo.boltechgroup@gmail.com'})};
 assert.deepEqual(await createSdrGmail(fetcher,env).verify(),{verified:true,sender:'ricardo.boltechgroup@gmail.com'});
});
test('provider expiration and session control remain distinguishable without guessing revocation cause',()=>{
 assert.equal(googleOauthDiagnostic({error:'invalid_grant',error_description:'Token has been expired or revoked.'}).category,'TOKEN_EXPIRED_OR_REVOKED');
 assert.equal(googleOauthDiagnostic({error:'invalid_grant',error_subtype:'invalid_rapt'}).category,'REAUTHENTICATION_REQUIRED');
 assert.equal(googleOauthDiagnostic({error:'invalid_grant'}).category,'CAUSE_UNDETERMINED');
});
test('diagnostic discards arbitrary provider fields and all free-form text',()=>{
 const d=googleOauthDiagnostic({error:'invalid_grant',error_description:'Token has been expired or revoked. SECRET_CANARY',error_subtype:'SECRET_CANARY',refresh_token:'SECRET_CANARY',access_token:'SECRET_CANARY'},'public-client',400);
 assert.equal(d.httpStatus,400);
 assert.equal(d.clientFingerprint,crypto.createHash('sha256').update('public-client').digest('hex').slice(0,16));
 assert.ok(!JSON.stringify(d).includes('SECRET_CANARY'));
 assert.deepEqual(googleOauthDiagnostic(null,'',999).category,'CAUSE_UNDETERMINED');
});
test('failed refresh emits only safe metadata and never reaches Gmail or retries',async t=>{
 let calls=0;const logs=[];
 t.mock.method(console,'error',(...args)=>logs.push(args));
 const gmail=createSdrGmail(async()=>{calls++;return {ok:false,status:400,json:async()=>({error:'invalid_grant',error_description:'Token has been expired or revoked. SECRET_CANARY',access_token:'SECRET_CANARY'})}},env);
 await assert.rejects(gmail.verify(),e=>e.code==='GMAIL_OAUTH_INVALID_GRANT');
 assert.equal(calls,1);assert.equal(logs.length,1);
 assert.equal(JSON.parse(logs[0][1]).category,'TOKEN_EXPIRED_OR_REVOKED');
 assert.ok(!JSON.stringify(logs).includes('SECRET_CANARY'));
 for(const value of Object.values(env))assert.ok(!JSON.stringify(logs).includes(value));
});

test('temporary Gmail read rejection retries once and recovers',async()=>{
 let reads=0;
 const gmail=createSdrGmail(async url=>{
  if(url.includes('oauth2'))return Response.json({access_token:'test',expires_in:3600});
  if(++reads===1)return Response.json({error:{errors:[{reason:'backendError'}]}},{status:503});
  return Response.json({emailAddress:'ricardo.boltechgroup@gmail.com'});
 },env);
 assert.equal((await gmail.verify()).verified,true);assert.equal(reads,2);
});
test('send rejection is never retried and diagnostic excludes provider free text',async()=>{
 let sends=0;
 const gmail=createSdrGmail(async url=>{
  if(url.includes('oauth2'))return Response.json({access_token:'test',expires_in:3600});
  if(url.endsWith('/profile'))return Response.json({emailAddress:'ricardo.boltechgroup@gmail.com'});
  sends++;return Response.json({error:{message:'SECRET_CANARY',errors:[{reason:'insufficientPermissions'}]}},{status:403});
 },env);
 await assert.rejects(gmail.send({email:'qa@example.com',subject:'Test',text:'Test',rfcMessageId:'test@example.com'}),e=>{
  assert.deepEqual(e.diagnostic,{stage:'SEND',httpStatus:403,reason:'insufficientPermissions'});
  assert.ok(!JSON.stringify(e).includes('SECRET_CANARY'));return true;
 });assert.equal(sends,1);
});

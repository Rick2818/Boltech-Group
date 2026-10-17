import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createSdrGmail, googleOauthDiagnostic} from '../lib/sdr_gmail.js';
const env={GMAIL_OAUTH_CLIENT_ID:'test-client',GMAIL_OAUTH_CLIENT_SECRET:'test-secret',GMAIL_OAUTH_REFRESH_TOKEN:'test-refresh'};
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {createSdrGmail} from '../lib/sdr_gmail.js';
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

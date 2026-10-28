import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgent1GmailAdapter} from '../lib/agent1_v2_gmail_adapter.js';
test('sender adapter fails closed without business sender verification',()=>assert.throws(()=>createAgent1GmailAdapter({gmail:{send:async()=>({})}}),/PREFLIGHT_REQUIRED/));
test('business Gmail adapter returns receipt with synthetic provider',async()=>{
 const sent=[];
 const adapter=createAgent1GmailAdapter({verifiedSender:true,gmail:{send:async p=>{sent.push(p);return {messageId:'synthetic-msg',threadId:'synthetic-thread'};}}});
 const receipt=await adapter.send({to:'test@example.com',subject:'Test',body:'Message',idempotencyKey:'a'.repeat(64)});
 assert.equal(receipt.messageId,'synthetic-msg');
 assert.match(sent[0].rfcMessageId,/^[a-f0-9]{32}@boltech-group\.vercel\.app$/);
 assert.equal(receipt.rfcMessageId,sent[0].rfcMessageId);
});

import {createSdrGmail} from '../lib/sdr_gmail.js';

test('synthetic Gmail transport emits exactly one RFC Message-ID bracket pair',async()=>{
 const requests=[];
 const fetcher=async(url,options={})=>{
  requests.push({url,options});
  if(url==='https://oauth2.googleapis.com/token')return {ok:true,json:async()=>({access_token:'synthetic-access-token',expires_in:3600})};
  if(url==='https://gmail.googleapis.com/gmail/v1/users/me/profile')return {ok:true,json:async()=>({emailAddress:'ricardo.boltechgroup@gmail.com'})};
  if(url==='https://gmail.googleapis.com/gmail/v1/users/me/messages/send')return {ok:true,json:async()=>({id:'synthetic-msg',threadId:'synthetic-thread'})};
  throw Error('UNEXPECTED_SYNTHETIC_REQUEST');
 };
 const env={GMAIL_OAUTH_CLIENT_ID:'synthetic-client',GMAIL_OAUTH_CLIENT_SECRET:'synthetic-secret',GMAIL_OAUTH_REFRESH_TOKEN:'synthetic-refresh',AGENT1_OPERATION_MODE:'TEST'};
 const gmail=createSdrGmail(fetcher,env);
 const adapter=createAgent1GmailAdapter({gmail,verifiedSender:true});
 const receipt=await adapter.send({to:'test@example.com',subject:'Synthetic only',body:'No real delivery',idempotencyKey:'a'.repeat(64)});
 const sends=requests.filter(r=>r.url.endsWith('/messages/send'));
 assert.equal(sends.length,1);
 assert.equal(requests.length,3);
 const mime=Buffer.from(JSON.parse(sends[0].options.body).raw,'base64url').toString('utf8');
 const match=mime.match(/^Message-ID: <([a-f0-9]{32}@boltech-group\\.vercel\\.app)>\\r?$/m);
 assert.ok(match,'MIME must contain exactly one bracket pair');
 assert.doesNotMatch(mime,/Message-ID: <<|Message-ID: <[^\\r\\n]+>>/);
 assert.equal(receipt.rfcMessageId,match[1]);
 assert.equal(receipt.messageId,'synthetic-msg');
});

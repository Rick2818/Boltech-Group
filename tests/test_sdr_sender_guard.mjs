import test from 'node:test';
import assert from 'node:assert/strict';
import { createSdrGmail, SDR_SENDER } from '../lib/sdr_gmail.js';

const env = {
  GMAIL_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
  GMAIL_OAUTH_CLIENT_SECRET: 'testing-secret',
  GMAIL_OAUTH_REFRESH_TOKEN: 'testing-refresh-token'
};
const job = {
  email: 'valid@example.com',
  subject: 'Test',
  rfcMessageId: 'unique@boltech.example',
  text: 'Hello'
};

test('refuses outgoing Gmail dispatch when OAuth resolves to a different mailbox', async () => {
  let sendCalls = 0;
  const fetcher = async url => {
    if (url.endsWith('/token')) return {ok:true,json:async()=>({access_token:'test',expires_in:3600})};
    if (url.endsWith('/profile')) return {ok:true,json:async()=>({emailAddress:'unexpected@example.com'})};
    if (url.endsWith('/messages/send')) sendCalls++;
    throw Error('Unexpected request: '+url);
  };
  await assert.rejects(createSdrGmail(fetcher,env).send(job), {code:'GMAIL_SENDER_MISMATCH'});
  assert.equal(sendCalls,0);
});

test('allows dispatch for verified sender and returns provider receipt', async () => {
  const calls=[];
  const fetcher=async url => {
    calls.push(url);
    if (url.endsWith('/token')) return {ok:true,json:async()=>({access_token:'test',expires_in:3600})};
    if (url.endsWith('/profile')) return {ok:true,json:async()=>({emailAddress:SDR_SENDER})};
    if (url.endsWith('/messages/send')) return {ok:true,json:async()=>({id:'gmail-id',threadId:'thread-id'})};
    throw Error('Unexpected request: '+url);
  };
  assert.deepEqual(await createSdrGmail(fetcher,env).send(job), {messageId:'gmail-id',threadId:'thread-id'});
  assert.ok(calls.indexOf('https://gmail.googleapis.com/gmail/v1/users/me/profile') < calls.indexOf('https://gmail.googleapis.com/gmail/v1/users/me/messages/send'));
});

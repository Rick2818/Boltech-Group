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

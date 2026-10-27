import {createHash} from 'node:crypto';
import {createSdrGmail} from './sdr_gmail.js';

// Reuses the established business sender. Must be invoked only after documented
// recipient verification + Gmail-history clearance by the controller.
// Not activated by importing this module.
export function createAgent1GmailAdapter({gmail=createSdrGmail(),verifiedSender=false}={}){
 if(verifiedSender!==true)throw Error('BUSINESS_SENDER_PREFLIGHT_REQUIRED');
 return {
  async send({to,subject,body,idempotencyKey}){
   if(!/^[a-f0-9]{64}$/.test(idempotencyKey||''))throw Error('INVALID_IDEMPOTENCY_KEY');
   if(typeof to!=='string'||!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to))throw Error('INVALID_TO');
   // createSdrGmail wraps Message-ID in angle brackets when building the MIME header.
   const rfcMessageId=createHash('sha256').update(idempotencyKey).digest('hex').slice(0,32)+'@boltech-group.vercel.app';
   const result=await gmail.send({email:to,subject,text:body,rfcMessageId});
   if(!result?.messageId)throw Error('GMAIL_RECEIPT_UNKNOWN');
   return {messageId:result.messageId,threadId:result.threadId,rfcMessageId};
  }
 };
}

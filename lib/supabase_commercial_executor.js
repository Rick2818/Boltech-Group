import crypto from 'node:crypto';
import {createCommercialDispatchGate} from './supabase_commercial_dispatch_gate.js';
import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';

// Explicit invocation only: research cycles must never call this automatically.
export function createSupabaseCommercialExecutor({gate=createCommercialDispatchGate(),gmail=createSdrGmail(),now=()=>new Date()}={}){
 async function dispatch(idempotencyKey){
  const row=await gate.get(idempotencyKey);
  if(!row)throw Error('DISPATCH_NOT_FOUND');
  if(row.state!=='AUTHORIZED')throw Error('DISPATCH_NOT_AUTHORIZED');
  if(row.channel!=='gmail'||row.authorization_evidence?.approved!==true||
     row.eligibility_evidence?.approved!==true||row.suppression_evidence?.clear!==true)
    throw Error('DISPATCH_EVIDENCE_REQUIRED');
  const reviewedAt=Date.parse(row.suppression_evidence?.checkedAt);
  if(!Number.isFinite(reviewedAt)||now().getTime()-reviewedAt>3600000||reviewedAt>now().getTime())
    throw Error('DISPATCH_SUPPRESSION_STALE');
  await gmail.verify();
  // Fail closed if any prior correspondence exists. Do not resend after uncertain outcomes.
  const history=await gmail.search('in:anywhere {to:'+row.recipient_email+' from:'+row.recipient_email+'}');
  if(history.length)throw Error('DISPATCH_EXISTING_GMAIL_HISTORY');
  const reserved=await gate.reserve(idempotencyKey);
  const sending=await gate.markSending(idempotencyKey);
  const rfcMessageId='boltech-'+crypto.createHash('sha256').update(idempotencyKey).digest('hex')+'@boltech-group.vercel.app';
  let receipt;
  try{
   receipt=await gmail.send({email:sending.recipient_email,subject:sending.subject,text:sending.body_text,rfcMessageId});
  }catch{
   // Leave SENDING permanently held until independent provider reconciliation.
   throw Error('DISPATCH_PROVIDER_OUTCOME_UNCERTAIN');
  }
  return gate.receipt(idempotencyKey,{messageId:receipt.messageId,sentAt:now().toISOString()});
 }
 return {dispatch,sender:SDR_SENDER};
}

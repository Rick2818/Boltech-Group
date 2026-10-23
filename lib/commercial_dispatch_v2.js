// Gmail dispatch adapter v2: persistence is an injected atomic store, never local memory in production.
// store.reserve MUST atomically compare-and-swap by key across all workers.
// store.setUnknown and store.markSent MUST persist before acknowledgement to caller.
import {createHash} from 'node:crypto';
export const deliveryKey=({sender,recipient,campaignId,purpose='INITIAL'})=>createHash('sha256').update([sender,recipient,campaignId,purpose].map(x=>String(x||'').trim().toLowerCase()).join('|')).digest('hex');
export async function dispatchVerifiedV2({receipt,sender,campaignId,purpose='INITIAL',store,provider,recheck}){
 if(receipt?.status!=='CLEAR'||receipt?.sendAuthorized!==true) return {status:'HELD',reason:'VERIFICATION_NOT_CLEAR'};
 if(!receipt.recipient||!sender||!campaignId||!store||!provider||typeof recheck!=='function')return {status:'HELD',reason:'DISPATCH_CONFIGURATION_MISSING'};
 const key=deliveryKey({sender,recipient:receipt.recipient,campaignId,purpose});
 const existing=await store.get(key);
 if(existing)return {status:existing.status,key,reason:'EXISTING_DISPATCH_MUST_RECONCILE'};
 const eligible=await recheck(receipt);
 if(eligible!==true)return {status:'HELD',key,reason:'PREFLIGHT_NOT_CLEAR'};
 const reservation=await store.reserve({key,sender,recipient:receipt.recipient,campaignId,purpose,status:'RESERVED'});
 if(reservation?.created!==true)return {status:reservation?.status||'HELD',key,reason:'CONCURRENT_OR_DUPLICATE_RESERVATION'};
 // Never automatically re-POST after an ambiguous result, even if provider throws.
 try{
   await store.markSending(key);
   const sent=await provider.send({recipient:receipt.recipient,campaignId,key});
   if(!sent?.id||!sent?.threadId){await store.setUnknown(key,'PROVIDER_RECEIPT_INCOMPLETE');return {status:'SEND_UNKNOWN',key};}
   await store.markSent(key,{providerMessageId:sent.id,providerThreadId:sent.threadId});
   return {status:'SENT',key,providerMessageId:sent.id,providerThreadId:sent.threadId};
 }catch{
   await store.setUnknown(key,'GMAIL_RESPONSE_UNCERTAIN');
   return {status:'SEND_UNKNOWN',key};
 }
}
export async function reconcileUnknownV2({key,store,provider}){
 const entry=await store.get(key);
 if(!entry||!['SEND_UNKNOWN','SENDING'].includes(entry.status))return {status:'NO_RECONCILIATION',key};
 // Search by exact provider-independent deterministic key; if the actual Gmail transport
 // does not preserve searchable key/Message-ID, remain UNKNOWN and require human review.
 try{
  const matches=await provider.lookup(key,entry);
  if(!Array.isArray(matches)||matches.length!==1||!matches[0].id||!matches[0].threadId)
   return {status:'SEND_UNKNOWN',key,reason:'AMBIGUOUS_OR_MISSING_PROVIDER_EVIDENCE'};
  await store.markSent(key,{providerMessageId:matches[0].id,providerThreadId:matches[0].threadId});
  return {status:'SENT',key,providerMessageId:matches[0].id};
 }catch{return {status:'SEND_UNKNOWN',key,reason:'PROVIDER_LOOKUP_UNAVAILABLE'};}
}

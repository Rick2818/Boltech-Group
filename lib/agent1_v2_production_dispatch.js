// Alternate Agent 1 execution on the SAME canonical outbox and Gmail transport.
// Never create a second ledger, sender route, schedule, or authorization policy.
import {createSalesAgentV2} from './agent1_v2_core.js';
import {deliveryKey} from './commercial_dispatch_v2.js';
export async function dispatchAlternateAgent1({receipt,sender,campaignId,purpose='INITIAL',store,provider,recheck}){
 if(receipt?.status!=='CLEAR'||receipt.sendAuthorized!==true)return {status:'HELD',reason:'VERIFICATION_NOT_CLEAR'};
 if(!store||!provider||typeof recheck!=='function')return {status:'HELD',reason:'DISPATCH_CONFIGURATION_MISSING'};
 const key=deliveryKey({sender,recipient:receipt.recipient,campaignId,purpose});
 const existing=await store.get(key);
 if(existing)return {status:existing.status,key,reason:'EXISTING_DISPATCH_MUST_RECONCILE'};
 if(await recheck(receipt)!==true)return {status:'HELD',key,reason:'PREFLIGHT_NOT_CLEAR'};
 let proof;
 const state=x=>x==='SEND_UNKNOWN'||x==='SENDING'?'UNKNOWN':x;
 const ledger={
  read:async()=>{const row=await store.get(key);return row?{...row,state:state(row.status)}:null;},
  insertIfAbsent:async()=>{throw Error('VERIFIED_RECEIPT_REQUIRED');},
  reserveProspectAtomically:async()=>{const r=await store.reserve({key,sender,recipient:receipt.recipient,campaignId,purpose,status:'RESERVED'});return {reserved:r?.created===true,state:state(r?.status||'BLOCKED'),reason:r?.reason};},
  updateIfState:async(_key,_expected,patch)=>{
   if(patch.state==='SENT')await store.markSent(key,{providerMessageId:proof.id,providerThreadId:proof.threadId});
   else await store.setUnknown(key,patch.reason);
   return true;
  }
 };
 const agent=createSalesAgentV2({ledger,sender:{send:async()=>{
  await store.markSending(key);
  proof=await provider.send({recipient:receipt.recipient,campaignId,key});
  if(!proof?.id||!proof.threadId)throw Error('PROVIDER_RECEIPT_INCOMPLETE');
  return {messageId:proof.id};
 }}});
 // The independently persisted CLEAR receipt is the authority for normalization;
 // source, history, marketing, policy and suppression gates ran before this adapter.
 const result=await agent.dispatch({prospect:{email:receipt.recipient},verifiedReceipt:receipt,message:{subject:'CANONICAL_APPROVED_MESSAGE',body:'Provider resolves the approved canonical message.'}});
 return {status:result.state==='UNKNOWN'?'SEND_UNKNOWN':result.state,key,reason:result.reason,providerMessageId:proof?.id,providerThreadId:proof?.threadId};
}

import {SDR_SENDER} from './sdr_gmail.js';
// Each result states what actually ran. Drafting is never delivery or a sale.
export async function executeAlternative({decision,event,account,material,gmail,now}) {
 const action=decision.action;
 const result=(status,extra={})=>({status,action,verified:status==='SUCCEEDED'||status==='FAILED',checkedAt:now(),...extra});
 if(decision.to==='DIRECTORA')return result('DIRECTOR_DECISION_REQUIRED',{requiredDecision:action});
 const drafts={
  PREPARE_ROLE_SPECIFIC_MATERIAL:'Role-specific sales support',
  REFRAME_ONE_SPECIFIC_PROBLEM:'Ask the customer to identify one concrete manual step before proposing a solution.',
  REQUEST_MINIMUM_DATA_IN_WRITING:'Request the current process, tools, volume, responsible person and expected measurable result.',
  PREPARE_REDUCED_SCOPE_PENDING_VALIDATION:'Draft one workflow and one integration; customer fit, technical scope and price remain unapproved.',
  PROVIDE_WRITTEN_PROCESS_WALKTHROUGH:'Written walkthrough: receive request, validate minimum data, assign owner, record next step, test duplicates and integration failures. Demonstration not executed.',
  CLARIFY_APPROVED_SCOPE_AND_VALUE:'Use only the individually approved quote; identify the manual step and agreed acceptance criteria. No new price or promised savings.',
  USE_LOCAL_PRIVATE_MATERIAL_AND_KEEP_PENDING_SYNC:'Store private material in the common durable queue. Local delivery and CRM synchronization remain unverified.',
  CLARIFY_THE_SALES_BLOCKER:'Record which missing customer fact, tool or approved scope prevents the next sales step.',
  WRITTEN_FOLLOWUP_WITH_EXISTING_THREAD:'Prepare a follow-up draft only. Existing customer thread and individual sending authorization must be checked before delivery.'
 };
 if(drafts[action])return result('SUCCEEDED',{receiptKind:'PERSISTED_PRIVATE_DRAFT',artifact:{action,instruction:drafts[action],materials:material.materials},deliveryStatus:'NOT_SENT',saleInferred:false});
 try {
  if(['CHECK_STATUS_WITH_READ_ONLY_REQUEST','REVIEW_FIT_AND_HISTORY','RECONCILE_PROVIDER_RECEIPT_WITHOUT_RESENDING'].includes(action)) {
   if((await gmail.verify()).verified!==true)throw Object.assign(Error('INTERAGENT_GMAIL_UNVERIFIED'),{code:'INTERAGENT_GMAIL_UNVERIFIED'});
   if(action==='CHECK_STATUS_WITH_READ_ONLY_REQUEST')return result('SUCCEEDED',{receiptKind:'GMAIL_PROFILE_VERIFIED'});
   const email=String(account.fields?.['Contact Email']||'').toLowerCase();
   if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email))throw Object.assign(Error('INTERAGENT_CONTACT_UNVERIFIED'),{code:'INTERAGENT_CONTACT_UNVERIFIED'});
   if(action==='REVIEW_FIT_AND_HISTORY')return result('SUCCEEDED',{receiptKind:'GMAIL_HISTORY_READ',messageCount:(await gmail.search(`from:${email} OR to:${email}`)).length});
   if(!/^[a-zA-Z0-9_.@-]{1,200}$/.test(event.rfcMessageId||''))return result('DIRECTOR_DECISION_REQUIRED',{requiredDecision:'PROVIDE_ORIGINAL_SEND_MESSAGE_ID',deliveryStatus:'UNKNOWN',resendingAllowed:false});
   const found=await gmail.search(`rfc822msgid:${event.rfcMessageId}`);
   const messages=await Promise.all(found.slice(0,5).map(m=>gmail.message(m.id)));
   const sent=messages.find(m=>m.sent&&m.from===SDR_SENDER&&(String(m.to||'').toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[]).includes(email)&&m.rfcMessageId?.replace(/[<>]/g,'')===event.rfcMessageId);
   return result('SUCCEEDED',{receiptKind:'PROVIDER_RECEIPT_RECONCILIATION',deliveryStatus:sent?'SENT_CONFIRMED':'UNKNOWN',messageId:sent?.id||null,resendingAllowed:false});
  }
 }catch(error){return result('FAILED',{code:/^[A-Z_]+$/.test(error.code||'')?error.code:'INTERAGENT_READ_UNCONFIRMED'});}
 return result('DIRECTOR_DECISION_REQUIRED',{requiredDecision:action,reason:'No authorized executable adapter or verified source is configured for this action.',deliveryStatus:'NOT_EXECUTED'});
}

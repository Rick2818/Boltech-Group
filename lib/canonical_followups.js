import {randomUUID} from 'node:crypto';
import {processFirstFollowup} from './canonical_followup_sender.js';
import {SDR_SENDER} from './sdr_gmail.js';
import {classifySalesReply} from './agent1_v2_sales_cycle.js';

const email=value=>String(value||'').trim().toLowerCase();
export const containsAddress=(value,address)=>String(value||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)?.includes(email(address))===true;
export const latestFirst=messages=>[...messages].sort((a,b)=>Date.parse(b.receivedAt)-Date.parse(a.receivedAt));
export const currentReplyText=text=>String(text||'').split(/\n(?:>|On .*wrote:|El .*escribi[oó]:)/)[0].trim();

// Reuse the canonical work row for observation, scheduling, send intent and receipt.
export async function reconcileCanonicalFollowups({leads,gmail,db,now=new Date(),command}){
 const stats={checked:0,waiting:0,responded:0,suppressed:0,held:0,sent:0,reconciled:0,unknown:0,errors:[]};
 for(const lead of leads.filter(l=>l.status==='CONTACTED'&&!/qa|synthetic/i.test(l.data_quality||''))){
  const originalId=lead.source_payload?.gmail_sent_message_id;
  if(!originalId){stats.held++;continue;}
  const workId='followup:'+lead.id+':'+originalId;
  const path='/agent_work?work_id=eq.'+encodeURIComponent(workId);
  let runId,owned=false,receipt;
  const headers={'Content-Type':'application/json',Prefer:'return=representation'};
  try{
   await db('/agent_work?on_conflict=work_id',{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([{work_id:workId,lead_id:lead.id,owner_agent:'AGENT1',status:'WAITING',execution_state:'RECONCILIATION_PENDING',next_action:'Verify provider history before follow-up.',execution_receipt:{},updated_at:now.toISOString()}])});
   const [work]=await db(path+'&select=execution_run_id,execution_receipt');
   if(!work)throw Error('FOLLOWUP_WORK_MISSING');
   receipt={...(work.execution_receipt||{})};
   if(Date.parse(receipt.leaseUntil)>now.getTime()){stats.held++;continue;}
   runId=randomUUID();receipt.leaseUntil=new Date(now.getTime()+300000).toISOString();
   const previous=work.execution_run_id?'eq.'+encodeURIComponent(work.execution_run_id):'is.null';
   const claim=await db(path+'&execution_run_id='+previous,{method:'PATCH',headers,body:JSON.stringify({execution_run_id:runId,execution_receipt:receipt,updated_at:now.toISOString()})});
   if(claim?.length!==1){stats.held++;continue;}
   owned=true;
   const save=async state=>{
    const rows=await db(path+'&execution_run_id=eq.'+runId,{method:'PATCH',headers,body:JSON.stringify({execution_state:state,execution_receipt:receipt,updated_at:now.toISOString()})});
    if(rows?.length!==1)throw Error('FOLLOWUP_LEASE_LOST');
    const [saved]=await db(path+'&select=execution_state,execution_run_id,execution_receipt');
    if(saved?.execution_run_id!==runId||saved.execution_state!==state||saved.execution_receipt?.sendState!==receipt.sendState)throw Error('FOLLOWUP_READBACK_MISSING');
   };
   const original=await gmail.message(originalId);
   if(!original.sent||email(original.from)!==SDR_SENDER||!containsAddress(original.to,lead.contact_email)||!original.threadId)throw Error('FOLLOWUP_ORIGINAL_UNVERIFIED');
   const thread=await gmail.thread(original.threadId);
   if(!thread.some(m=>m.id===original.id))throw Error('FOLLOWUP_THREAD_UNVERIFIED');
   const hits=await gmail.search('in:anywhere "'+email(lead.contact_email)+'"');
   if(hits.length>50)throw Error('FOLLOWUP_HISTORY_REVIEW_REQUIRED');
   const related=await Promise.all(hits.filter(h=>!thread.some(m=>m.id===h.id)).map(h=>gmail.message(h.id)));
   const messages=[...thread,...related];
   const bounced=messages.some(m=>!m.sent&&/mailer-daemon|postmaster/i.test(m.from)&&Date.parse(m.receivedAt)>Date.parse(original.receivedAt)&&String(m.text||'').toLowerCase().includes(email(lead.contact_email))&&/undeliver|delivery.{0,30}fail|550|5\.1\.1/i.test(m.subject+' '+m.text));
   const incoming=latestFirst(messages.filter(m=>!m.sent&&email(m.from)===email(lead.contact_email)&&containsAddress(m.to,SDR_SENDER)&&Date.parse(m.receivedAt)>Date.parse(original.receivedAt)));
   const human=incoming.find(m=>!m.automatic);
   const optedOut=incoming.filter(m=>!m.automatic).some(m=>['SUPPRESS','STOP_SEQUENCE'].includes(classifySalesReply({text:currentReplyText(m.text)}).action));
   const blocked=bounced||optedOut;
   const observed=blocked?'SUPPRESSED':human?'CUSTOMER_REPLIED':incoming.length?'AUTOMATIC_REPLY_HOLD':null;
   Object.assign(receipt,{originalMessageId:original.id,threadId:original.threadId,lastCustomerMessageId:human?.id||null,checkedAt:now.toISOString(),sequenceCancelled:blocked||Boolean(incoming.length),sendEligible:!blocked&&!incoming.length,reason:bounced?'DELIVERY_FAILURE':blocked?'CUSTOMER_STOP':human?'CUSTOMER_REPLY':incoming.length?'AUTOMATIC_REPLY':'AWAITING_THREE_CALENDAR_DAYS'});
   const result=await processFirstFollowup({lead,original,messages,receipt,gmail,db,save,now,command});
   const state=observed||result.state;
   const next=blocked?'Do not contact: customer declined, opted out or delivery failed.':human?'Review the current customer reply in writing; unanswered-email sequence cancelled.':incoming.length?'Review automatic response before any follow-up.':result.state==='FOLLOWUP_SENT'?'Monitor this thread for a reply; first follow-up already sent.':result.state==='UNKNOWN_SEND_STATE'?'Reconcile the deterministic Gmail Message-ID; never resend an uncertain attempt.':'First follow-up due '+receipt.dueAt+'; reconcile history, suppression and sending window before sending.';
   await save(state);
   const final=await db(path+'&execution_run_id=eq.'+runId,{method:'PATCH',headers,body:JSON.stringify({status:blocked?'CANCELLED':human?'REVIEW_REQUIRED':'WAITING',next_action:next,updated_at:now.toISOString()})});
   if(final?.length!==1)throw Error('FOLLOWUP_LEASE_LOST');
   await db('/leads?id=eq.'+lead.id,{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({next_action:next,...(blocked?{status:'SUPPRESSED',commercial_stage:'SUPPRESSED'}:human?{commercial_stage:'REPLIED'}:{}),updated_at:now.toISOString()})});
   if(blocked)Object.assign(lead,{status:'SUPPRESSED',commercial_stage:'SUPPRESSED'});
   stats.checked++;if(blocked)stats.suppressed++;else if(human)stats.responded++;else if(incoming.length||result.state==='UNKNOWN_SEND_STATE')stats.held++;else stats.waiting++;
   if(result.state==='UNKNOWN_SEND_STATE')stats.unknown++;
   if(result.sent)stats.sent++;if(result.reconciled)stats.reconciled++;
  }catch(error){stats.held++;stats.errors.push({leadId:lead.id,error:/^[A-Z0-9_]+$/.test(error.message)?error.message:'FOLLOWUP_RECONCILIATION_FAILED'});}
  finally{
   if(owned){receipt.leaseUntil=null;const rows=await db(path+'&execution_run_id=eq.'+runId,{method:'PATCH',headers,body:JSON.stringify({execution_receipt:receipt,updated_at:now.toISOString()})});if(rows?.length!==1)throw Error('FOLLOWUP_LEASE_RELEASE_FAILED');}
  }
 }
 return stats;
}

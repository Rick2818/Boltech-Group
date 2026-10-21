import {SDR_SENDER} from './sdr_gmail.js';
import {classifySalesReply} from './agent1_v2_sales_cycle.js';

const email=value=>String(value||'').trim().toLowerCase();
export const containsAddress=(value,address)=>String(value||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)?.includes(email(address))===true;
export const latestFirst=messages=>[...messages].sort((a,b)=>Date.parse(b.receivedAt)-Date.parse(a.receivedAt));
export const currentReplyText=text=>String(text||'').split(/\n(?:>|On .*wrote:|El .*escribi[oó]:)/)[0].trim();

// Reconcile the canonical CRM with provider evidence. Never invent a send date
// or repeat outreach because a thread has been silent.
export async function reconcileCanonicalFollowups({leads,gmail,db,now=new Date()}){
 const stats={checked:0,waiting:0,responded:0,suppressed:0,held:0,errors:[]};
 for(const lead of leads.filter(l=>l.status==='CONTACTED'&&!/qa|synthetic/i.test(l.data_quality||''))){
  try{
   const originalId=lead.source_payload?.gmail_sent_message_id;
   if(!originalId){stats.held++;continue;}
   const original=await gmail.message(originalId);
   if(!original.sent||email(original.from)!==SDR_SENDER||!containsAddress(original.to,lead.contact_email)||!original.threadId)throw Error('FOLLOWUP_ORIGINAL_UNVERIFIED');
   const messages=await gmail.thread(original.threadId);
   if(!messages.some(m=>m.id===original.id))throw Error('FOLLOWUP_THREAD_UNVERIFIED');
   const bounceHits=await gmail.search('in:anywhere {from:mailer-daemon from:postmaster} "'+email(lead.contact_email)+'" newer_than:30d');
   if(bounceHits.length>30)throw Error('FOLLOWUP_BOUNCE_HISTORY_REVIEW_REQUIRED');
   const bounceMessages=await Promise.all(bounceHits.map(m=>gmail.message(m.id)));
   const bounced=bounceMessages.some(m=>!m.sent&&/mailer-daemon|postmaster/i.test(m.from)&&Date.parse(m.receivedAt)>Date.parse(original.receivedAt)&&String(m.text||'').toLowerCase().includes(email(lead.contact_email))&&/undeliver|delivery.{0,30}fail|550|5\.1\.1/i.test(m.subject+' '+m.text));
   const incoming=latestFirst(messages.filter(m=>!m.sent&&email(m.from)===email(lead.contact_email)&&containsAddress(m.to,SDR_SENDER)&&Date.parse(m.receivedAt)>Date.parse(original.receivedAt)));
   const human=incoming.find(m=>!m.automatic);
   const decision=human?classifySalesReply({text:currentReplyText(human.text)}):null;
   const blocked=bounced||['SUPPRESS','STOP_SEQUENCE'].includes(decision?.action);
   const state=blocked?'SUPPRESSED':human?'CUSTOMER_REPLIED':incoming.length?'AUTOMATIC_REPLY_HOLD':'WAITING_RESPONSE';
   const next=blocked?'Do not contact: customer declined or opted out.':human?'Review the current customer reply in writing; cancel the unanswered-email sequence.':incoming.length?'Review automatic response before any follow-up.':'Watch this Gmail thread; record the approved follow-up due date before sending.';
   const receipt={originalMessageId:original.id,threadId:original.threadId,lastCustomerMessageId:human?.id||null,checkedAt:now.toISOString(),sequenceCancelled:blocked||Boolean(incoming.length),sendAuthorized:false,reason:bounced?'DELIVERY_FAILURE':blocked?'CUSTOMER_STOP':human?'CUSTOMER_REPLY':incoming.length?'AUTOMATIC_REPLY':'FOLLOWUP_DUE_DATE_NOT_CONFIGURED'};
   const workId='followup:'+lead.id+':'+original.id;
   await db('/agent_work?on_conflict=work_id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([{work_id:workId,lead_id:lead.id,owner_agent:'AGENT1',status:blocked?'CANCELLED':human?'REVIEW_REQUIRED':'WAITING',execution_state:state,next_action:next,execution_receipt:receipt,updated_at:now.toISOString()}])});
   const saved=await db('/agent_work?work_id=eq.'+encodeURIComponent(workId)+'&select=execution_state,execution_receipt');
   if(saved?.length!==1||saved[0].execution_state!==state||saved[0].execution_receipt?.threadId!==original.threadId)throw Error('FOLLOWUP_READBACK_MISSING');
   await db('/leads?id=eq.'+lead.id,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({next_action:next,...(blocked?{status:'SUPPRESSED',commercial_stage:'SUPPRESSED'}:human?{commercial_stage:'REPLIED'}:{}),updated_at:now.toISOString()})});
   if(blocked)Object.assign(lead,{status:'SUPPRESSED',commercial_stage:'SUPPRESSED'});
   stats.checked++;if(blocked)stats.suppressed++;else if(human)stats.responded++;else if(incoming.length)stats.held++;else stats.waiting++;
  }catch(error){stats.held++;stats.errors.push({leadId:lead.id,error:/^[A-Z0-9_]+$/.test(error.message)?error.message:'FOLLOWUP_RECONCILIATION_FAILED'});}
 }
 return stats;
}

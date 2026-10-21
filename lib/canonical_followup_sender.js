import {createHash} from 'node:crypto';
import policy from '../config/canonical_followups.json' with {type:'json'};
import {redisCommand} from './rsi_handoff_store.js';
import {SDR_SENDER} from './sdr_gmail.js';
import {isBlacklisted} from './compliance_dnc.js';

const hasAddress=(value,email)=>String(value||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)?.includes(email.toLowerCase())===true;
export function followupDueAt(timestamp,days=policy.firstFollowupCalendarDays){
 const date=new Date(Date.parse(timestamp)-6*3600000);
 if(!Number.isFinite(date.getTime())||!Number.isInteger(days)||days<1||days>30)throw Error('FOLLOWUP_CADENCE_INVALID');
 date.setUTCDate(date.getUTCDate()+days);
 if(date.getUTCHours()<9)date.setUTCHours(9,0,0,0);
 if(date.getUTCHours()>=17){date.setUTCDate(date.getUTCDate()+1);date.setUTCHours(9,0,0,0);}
 return new Date(date.getTime()+6*3600000).toISOString();
}
export function followupWindow(now){const date=new Date(now.getTime()-6*3600000);return date.getUTCHours()>=9&&date.getUTCHours()<17;}
export function firstFollowupText(original){
 const spanish=/\b(hola|cotizaciones|consultas|automatizaci[oó]n|saludos)\b/i.test(original.text||'');
 return spanish?'Hola,\n\nRetomo mi correo anterior. ¿El proceso que mencioné sigue siendo una prioridad para su equipo o ya lo tienen cubierto?\n\nSi les resulta pertinente, pueden compartir por este hilo las herramientas que usan y el resultado que necesitan. Evaluaremos por escrito el encaje de un piloto con alcance definido.\n\nSaludos,\nRicardo Bolaños | Boltech Group\nricardo.boltechgroup@gmail.com\nSi prefiere no recibir más seguimiento, responda «no».':"Hi,\n\nI'm following up on my earlier message below. Is the workflow I mentioned currently a priority for your team, or is it already covered?\n\nIf relevant, please reply with the tools you use and the outcome you need. We can assess a clearly scoped automation pilot by email.\n\nBest regards,\nRicardo Bolaños | Boltech Group\nricardo.boltechgroup@gmail.com\nIf you prefer no further follow-up, please reply no.";
}
// Caller owns the canonical per-contact lease. save() must verify durable readback.
export async function processFirstFollowup({lead,original,messages,receipt,gmail,db,save,now,command=redisCommand,suppressionCheck=isBlacklisted,marketing}){
 receipt.dueAt=followupDueAt(original.receivedAt);
 receipt.cadenceCalendarDays=policy.firstFollowupCalendarDays;delete receipt.cadenceBusinessDays;
 receipt.sendAuthorized=policy.enabled;
 receipt.rfcMessageId='boltech-followup-'+createHash('sha256').update(lead.id+':'+original.id+':first').digest('hex')+'@boltech-group.vercel.app';
 if(['SEND_PENDING','UNKNOWN'].includes(receipt.sendState)){
  const hits=await gmail.search('in:sent rfc822msgid:'+receipt.rfcMessageId);
  if(hits.length===1){const sent=await gmail.message(hits[0].id);if(sent.sent&&sent.from===SDR_SENDER&&hasAddress(sent.to,lead.contact_email)&&sent.threadId===original.threadId&&String(sent.rfcMessageId||'').replace(/[<>]/g,'')===receipt.rfcMessageId){receipt.sendState='SENT';receipt.messageId=sent.id;receipt.sentAt=sent.receivedAt;await save('FOLLOWUP_SENT');return {state:'FOLLOWUP_SENT',reconciled:true,sent:false};}}
  return {state:'UNKNOWN_SEND_STATE',sent:false};
 }
 if(receipt.sendState==='SENT')return {state:'FOLLOWUP_SENT',sent:false};
 if(!receipt.sendEligible)return {state:receipt.sequenceCancelled?'SEQUENCE_CANCELLED':'FOLLOWUP_HOLD',sent:false};
 if(messages.some(m=>m.sent&&m.from===SDR_SENDER&&m.id!==original.id&&hasAddress(m.to,lead.contact_email)&&Date.parse(m.receivedAt)>Date.parse(original.receivedAt)))return {state:'EXISTING_FOLLOWUP_HOLD',sent:false};
 if(!policy.enabled||policy.maxUnansweredFollowups!==1)return {state:'FOLLOWUP_POLICY_HOLD',sent:false};
 let support,supportText;
 if(marketing){const text=firstFollowupText(original),language=text.startsWith('Hola')?'es':'en';support=await marketing.ensure({lead,triggerMessageId:original.id,kind:'FOLLOWUP',language,draft:{subject:'Re: '+String(original.subject||'Your workflow').replace(/^re:\s*/i,''),body:text}});receipt.marketingEventId=support.eventId;supportText=support.material.materials[language].text;}
 if(now.getTime()<Date.parse(receipt.dueAt))return {state:'FOLLOWUP_SCHEDULED',sent:false};
 if(!followupWindow(now))return {state:'OUTSIDE_SEND_WINDOW',sent:false};
 if(!original.rfcMessageId)throw Error('FOLLOWUP_ORIGINAL_RFC_ID_MISSING');
 const [current]=await db('/leads?id=eq.'+lead.id+'&select=id,status,commercial_stage,contact_email,data_quality,source_payload,notes');
 if(!current||current.status!=='CONTACTED'||current.contact_email?.toLowerCase()!==lead.contact_email.toLowerCase()||/SUPPRESSED|LOST|WON|REPLIED|QA|SYNTHETIC/i.test([current.commercial_stage,current.data_quality].join(' '))||current.source_payload?.unsubscribed||current.source_payload?.doNotContact||/do not contact|unsubscribe|hard.?bounce/i.test(current.notes||''))return {state:'CRM_CONTACT_HOLD',sent:false};
 const domain=lead.contact_email.split('@')[1].toLowerCase();
 if(await suppressionCheck(lead.contact_email,domain)||await command(['GET','dnc:'+lead.contact_email.toLowerCase()])||await command(['GET','dnc:'+domain]))return {state:'DNC_CONTACT_HOLD',sent:false};
 if((await gmail.search('in:sent newer_than:1d')).length>=100)return {state:'MAILBOX_CAPACITY_HOLD',sent:false};
 const hour=Math.floor(now.getTime()/3600000)*3600000;
 const count=Number(await command(['ZCOUNT','boltech:sdr:jobs',hour,hour+3599999]));
 if(!Number.isFinite(count)||count>=20)return {state:'HOURLY_CAPACITY_HOLD',sent:false};
 const fresh=await gmail.thread(original.threadId);
 if(fresh.some(m=>Date.parse(m.receivedAt)>Date.parse(original.receivedAt)&&(!m.sent||m.from===SDR_SENDER&&hasAddress(m.to,lead.contact_email))))return {state:'THREAD_CHANGED_HOLD',sent:false};
 if(support)await marketing.accept(support,supportText);
 receipt.sendState='SEND_PENDING';receipt.claimedAt=now.toISOString();
 await save('SEND_PENDING');
 await command(['ZADD','boltech:sdr:jobs',now.getTime(),receipt.rfcMessageId]);
 try{
  const sent=await gmail.send({email:lead.contact_email,subject:'Re: '+String(original.subject||'Your workflow').replace(/^re:\s*/i,''),text:supportText||firstFollowupText(original),threadId:original.threadId,inReplyTo:original.rfcMessageId,rfcMessageId:receipt.rfcMessageId});
  if(!sent.messageId||sent.threadId!==original.threadId)throw Error('FOLLOWUP_SEND_RECEIPT_INVALID');
  receipt.sendState='SENT';receipt.messageId=sent.messageId;receipt.sentAt=now.toISOString();
 }catch{receipt.sendState='UNKNOWN';await save('UNKNOWN_SEND_STATE');return {state:'UNKNOWN_SEND_STATE',sent:false};}
 await save('FOLLOWUP_SENT');
 if(support)await marketing.use(support,receipt.messageId);
 return {state:'FOLLOWUP_SENT',sent:true};
}

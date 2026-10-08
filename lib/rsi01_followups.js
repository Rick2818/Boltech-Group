import crypto from 'node:crypto';
import config from '../config/rsi01_followups.json' with {type:'json'};
import {redisCommand} from './rsi_handoff_store.js';
import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
import {sdrWindow} from './sdr_dispatch.js';
const fail=code=>{throw Object.assign(Error(code),{code});};
const emails=value=>String(value||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[];
async function crm(id,fields){
 const token=process.env.AIRTABLE_TOKEN||process.env.AIRTABLE_PAT;if(!token)fail('FOLLOWUP_CRM_UNAVAILABLE');
 const r=await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID||'appCQZd0IhBHFoZ9P'}/tblZaox2MX5uYA5PZ/${id}`,{method:fields?'PATCH':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(fields?{body:JSON.stringify({fields})}:{}),signal:AbortSignal.timeout(8000)});
 if(!r.ok)fail('FOLLOWUP_CRM_UNAVAILABLE');return r.json();
}
export function createRsi01Followups({command=redisCommand,gmail=createSdrGmail(),record=crm,now=()=>new Date(),plan=config}={}){
 const read=async key=>{const raw=await command(['GET',key]);return raw?JSON.parse(raw):null;};
 async function sync(key,job,fields){const current=await record(job.recordId);const marker=`[RSI01_FOLLOWUP:${job.id}:${job.state}]`;const notes=current.fields.Notes||'';
  await record(job.recordId,{...fields,Notes:notes.includes(marker)?notes:`${notes}\n${marker}\n${JSON.stringify(job)}`});
  const saved=await record(job.recordId);if(!saved.fields.Notes?.includes(marker))fail('FOLLOWUP_CRM_SYNC_UNCONFIRMED');
  const next={...job,crmSynced:true};await command(['SET',key,JSON.stringify(next)]);return next;
 }
 async function account(p,lease){
  const id=crypto.createHash('sha256').update(`boltech:followup:${p.email.toLowerCase()}:${p.originalMessageId}`).digest('hex'),key=`boltech:sdr:followup:${id}`;
  const old=await read(key);
  if(old){
   if(['SEND_PENDING','UNKNOWN'].includes(old.state)){
    await gmail.verify();const found=await gmail.search(`in:sent rfc822msgid:${old.rfcMessageId}`);
    if(found.length!==1)return {state:old.state,retryAllowed:false};
    const sent=await gmail.message(found[0].id);
    if(!sent.sent||sent.from!==SDR_SENDER||!emails(sent.to).includes(p.email)||sent.threadId!==old.threadId||sent.rfcMessageId.replace(/[<>]/g,'')!==old.rfcMessageId)return {state:'UNKNOWN',retryAllowed:false};
    const job={...old,state:'SENT',messageId:sent.id,sentAt:sent.receivedAt};await command(['SET',key,JSON.stringify(job)]);await sync(key,job,{'Next Action':'RSI-01 reviews the customer reply; never repeat this follow-up.'});return {state:'SENT',reconciled:true};
   }
   if(old.crmSynced===false)await sync(key,old,old.state==='CUSTOMER_REPLY'?{'Commercial Stage':'Replied','Next Action':'RSI-02: review the verified customer reply, confirm need and scope in writing.'}:{'Next Action':'RSI-01: review this provider receipt; do not resend.'});
   if(old.state!=='SENT')return {state:old.state,reused:true};
  }
  const row=await record(p.recordId),f=row.fields||{};
  if(row.id!==p.recordId||String(f['Contact Email']).toLowerCase()!==p.email||!/^RSI-01$/.test(f['Experiment Cohort']||'')||f['Data Quality']==='QA'||f.Unsubscribed||f['Do Not Contact']||/unsubscribed|do not contact|rebote permanente|hard.?bounce|disqualified|SUPPRESSED/i.test([f.Status,f['Commercial Stage'],f.Notes].join(' ')))return {state:'CONTACT_HOLD'};
  await gmail.verify();const initial=await gmail.message(p.originalMessageId);
  if(!initial.sent||initial.from!==SDR_SENDER||!emails(initial.to).includes(p.email)||!initial.rfcMessageId||!initial.threadId)fail('FOLLOWUP_ORIGINAL_UNVERIFIED');
  const history=await gmail.search(`in:anywhere "${p.email}"`);if(history.length>30)fail('FOLLOWUP_HISTORY_REVIEW_REQUIRED');
  const messages=await Promise.all(history.map(m=>gmail.message(m.id)));
  const bounced=messages.some(m=>Date.parse(m.receivedAt)>Date.parse(initial.receivedAt)&&/mailer-daemon|postmaster/i.test(m.from)&&/delivery|undeliver|failed|rechaz|rebote/i.test(m.text+' '+m.subject));
  const replies=messages.filter(m=>m.from===p.email&&!m.sent&&m.threadId===initial.threadId&&Date.parse(m.receivedAt)>Date.parse(initial.receivedAt));
  if(bounced||replies.length){
   const reply=replies.find(m=>!m.automatic),stopped=reply&&/^(?:no|stop|unsubscribe)[.!\s]*$|no me interesa|no deseo/i.test((reply.text||'').split(/\n(?:>|On .*wrote:|El .*escribi[oó]:)/)[0].trim());
   const state=bounced?'BOUNCED':stopped?'SUPPRESSED':reply?'CUSTOMER_REPLY':'AUTOMATIC_REPLY_HOLD';
   const job={id,recordId:p.recordId,state,messageId:reply?.id||null,threadId:reply?.threadId||initial.threadId,checkedAt:now().toISOString(),crmSynced:false};
   if(old?.state==='SENT')await command(['SET',key,JSON.stringify(job)]);
   else if(await command(['SET',key,JSON.stringify(job),'NX'])!=='OK')return {state:'CONCURRENT_CYCLE_HOLD'};
   await sync(key,job,state==='CUSTOMER_REPLY'?{'Commercial Stage':'Replied','Next Action':'RSI-02: review the verified customer reply, confirm need and scope in writing.'}:{'Next Action':`RSI-01: ${state}; no further automatic emails.`});return {state};
  }
  if(old?.state==='SENT')return {state:'SENT',reused:true};
  if(messages.some(m=>m.from===p.email&&!m.sent&&Date.parse(m.receivedAt)>Date.parse(initial.receivedAt)))return {state:'OTHER_THREAD_REPLY_HOLD'};
  if(messages.some(m=>m.sent&&m.id!==initial.id&&Date.parse(m.receivedAt)>Date.parse(initial.receivedAt)))return {state:'EXISTING_FOLLOWUP_HOLD'};
  if(now()<new Date(p.dueAt))return {state:'NOT_DUE',dueAt:p.dueAt};
  if(now()>new Date(p.expiresAt))return {state:'AUTHORIZATION_EXPIRED'};
  if(!sdrWindow(now()).allowed)return {state:'OUTSIDE_SEND_WINDOW'};
  if((await gmail.search('in:sent newer_than:1d')).length>=100)return {state:'MAILBOX_CAPACITY_HOLD'};
  const hour=Math.floor(now().getTime()/3600000)*3600000;
  const count=Number(await command(['ZCOUNT','boltech:sdr:jobs',hour,hour+3599999]));if(!Number.isFinite(count)||count>=20)return {state:'HOURLY_CAPACITY_HOLD'};
  const job={id,recordId:p.recordId,email:p.email,subject:initial.subject,threadId:initial.threadId,inReplyTo:initial.rfcMessageId,rfcMessageId:`boltech-followup-${id}@boltech-group.vercel.app`,text:p.text,state:'SEND_PENDING',claimedAt:now().toISOString(),authorization:plan.authorization,crmSynced:false};
  if(await command(['SET',key,JSON.stringify(job),'NX'])!=='OK')return {state:'CONCURRENT_CYCLE_HOLD'};
  await command(['ZADD','boltech:sdr:jobs',now().getTime(),`followup:${id}`]);
  if((await read(key))?.state!=='SEND_PENDING')fail('FOLLOWUP_RESERVATION_UNCONFIRMED');
  try{await sync(key,job,{'Next Action':'RSI-01 follow-up pending; reconcile before any further attempt.'});}catch{return {state:'SEND_PENDING',sendingPerformed:false,retryAllowed:false};}
  // All provider mutations occur only after durable reservation and CRM readback.
  if(await command(['GET','boltech:sdr:mailbox-lease'])!==lease)return {state:'SEND_PENDING',sendingPerformed:false,retryAllowed:false};
  try{const sent=await gmail.send(job);const done={...job,...sent,state:'SENT',sentAt:now().toISOString(),crmSynced:false};await command(['SET',key,JSON.stringify(done)]);await sync(key,done,{'Next Action':'RSI-01: review replies; this follow-up must not be sent again.'});return {state:'SENT',sendingPerformed:true};}
  catch(error){const saved=await read(key);if(saved?.state==='SENT')return {state:'SENT',crmSynced:false,sendingPerformed:true};const state=['GMAIL_API_REJECTED','GMAIL_RATE_LIMITED'].includes(error.code)?'FAILED':'UNKNOWN';await command(['SET',key,JSON.stringify({...job,state,code:error.code||'FOLLOWUP_SEND_UNCONFIRMED'})]);return {state,retryAllowed:false};}
 }
 async function run(){
  if(!plan.enabled)return {enabled:false,results:[]};
  const lease=crypto.randomUUID();if(await command(['SET','boltech:sdr:mailbox-lease',lease,'NX','PX',90000])!=='OK')return {enabled:true,results:[{state:'MAILBOX_BUSY'}]};
  try{const results=[];for(const p of plan.accounts.slice(0,plan.maxPerCycle)){try{results.push(await account(p,lease));}catch(error){results.push({state:'BLOCKED',code:error.code||'FOLLOWUP_UNCONFIRMED'});}}return {enabled:true,results,saleInferred:false};}
  finally{await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,'boltech:sdr:mailbox-lease',lease]);}
 }
 return {run};
}

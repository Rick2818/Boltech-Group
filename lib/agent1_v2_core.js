import { createHash } from 'node:crypto';
export const STATES=Object.freeze({READY:'READY',RESERVED:'RESERVED',SENT:'SENT',UNKNOWN:'UNKNOWN',BLOCKED:'BLOCKED'});
const valid=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
const norm=e=>String(e||'').trim().toLowerCase();
export const campaignDate=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/El_Salvador',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export const prospectKey=(day,email)=>createHash('sha256').update(day+'|'+norm(email)).digest('hex');
export function qualifyProspect(p,history={}){
 const email=norm(p?.email);
 const clear=['gmail','crm','suppression'].every(k=>history[k]==='CLEAR');
 const ok=Boolean(p?.company&&/^(US|USA|United States)$/i.test(String(p.country||''))&&/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)&&String(p.officialWebsite||'').startsWith('https://')&&String(p.sourceUrl||'').startsWith('https://')&&p.publishedBusinessContact===true&&p.mxVerified===true&&p.humanVerified===true&&!p.synthetic&&!p.suppressed&&!p.bounced&&!p.unsubscribed&&clear);
 return {eligible:ok,email,reason:ok?'VERIFIED':'VERIFICATION_OR_SUPPRESSION_HOLD'};
}
export function createSalesAgentV2({ledger,sender,clock=()=>new Date().toISOString(),dailyCap=5}){
 valid(ledger&&['read','insertIfAbsent','updateIfState','reserveProspectAtomically'].every(k=>typeof ledger[k]==='function'),'ATOMIC_DURABLE_LEDGER_REQUIRED');
 valid(sender&&typeof sender.send==='function','SENDER_REQUIRED');
 valid(Number.isInteger(dailyCap)&&dailyCap>0&&dailyCap<=5,'INVALID_DAILY_CAP');
 async function dispatch({prospect,history,message}){
  const day=campaignDate(clock()),q=qualifyProspect(prospect,history),key=prospectKey(day,q.email);
  if(!q.email)return {state:STATES.BLOCKED,reason:'EMAIL_MISSING'};
  const globalKey=prospectKey('global',q.email);
  const prior=await ledger.read(key);
  if(prior)return {key,state:prior.state,reused:true};
  if(!q.eligible){await ledger.insertIfAbsent(key,{day,state:STATES.BLOCKED,reason:q.reason});return {key,state:STATES.BLOCKED};}
  valid(message?.subject?.trim()&&message?.body?.trim(),'MESSAGE_NOT_READY');
  // A SINGLE durable atomic operation must claim the global recipient and daily
  // slot. No separate read-then-write: competing workers must not both send.
  const hold=await ledger.reserveProspectAtomically({key,globalKey,day,recipient:q.email,cap:dailyCap});
  if(!hold?.reserved)return {key,state:hold?.state||STATES.BLOCKED,reason:hold?.reason||'RESERVATION_REFUSED',reused:true};
  try{
   const receipt=await sender.send({to:q.email,subject:message.subject,body:message.body,idempotencyKey:key});
   if(!receipt?.messageId)throw Error('PROVIDER_RECEIPT_MISSING');
   const updated=await ledger.updateIfState(key,STATES.RESERVED,{state:STATES.SENT,messageId:receipt.messageId});
   if(!updated)return {key,state:STATES.UNKNOWN,reason:'LEDGER_RECONCILIATION_REQUIRED'};
   return {key,state:STATES.SENT,messageId:receipt.messageId};
  }catch{
   await ledger.updateIfState(key,STATES.RESERVED,{state:STATES.UNKNOWN,reason:'SEND_RECONCILIATION_REQUIRED'});
   return {key,state:STATES.UNKNOWN,reason:'SEND_RECONCILIATION_REQUIRED'};
  }
 }
 return {dispatch};
}

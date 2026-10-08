import crypto from 'node:crypto';
import {createHandoffStore,redisCommand} from './rsi_handoff_store.js';
import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
import {validateClosingApproval} from './rsi03_closing.js';
import {paginationGuard} from './store_pagination.js';
const WORK='tblHVqUMifOFjlGvj',LEADS='tblZaox2MX5uYA5PZ';
const fail=code=>{throw Object.assign(Error(code),{code});};
const addresses=v=>String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[];
export const relayId=(from,to,opportunityId,evidenceRef)=>'relay-'+crypto.createHash('sha256').update(JSON.stringify({from,to,opportunityId,evidenceRef})).digest('hex');

// Existing agents use durable handoffs. No model, quote approval or extra sender.
export function createCommercialRelay({request,command=redisCommand,gmail=createSdrGmail(),env=process.env,now=()=>new Date().toISOString(),registerClosing}={}){
 const store=createHandoffStore(command,now),inbox=role=>`boltech:rsi:commercial:inbox:${role}`;
 async function list(table){let offset;const rows=[],next=paginationGuard(1000,20);do{const page=await request(table,{offset});offset=next(page);rows.push(...page.records);}while(offset);return rows;}
 async function qualified(h,leads){
  const lead=leads.find(l=>l.id===h.opportunityId),f=lead?.fields||{};
  if(!lead||!f['Contact Email']||f['Data Quality']==='QA'||f.Unsubscribed||f['Do Not Contact']||/bounced|disqualified|unsubscribed/i.test([f.Status,f['Commercial Stage'],f['Data Quality']].join(' ')))fail('RELAY_CUSTOMER_EXCLUDED');
  const message=await gmail.message(h.evidenceRef),email=String(f['Contact Email']).toLowerCase();
  if(message.id!==h.evidenceRef||message.from!==email||message.sent||message.automatic||!addresses(message.to).includes(SDR_SENDER)||!message.text?.trim()||!message.threadId||!message.rfcMessageId||!Number.isFinite(Date.parse(message.receivedAt))||Date.parse(message.receivedAt)>Date.parse(now())+60000)fail('RELAY_CUSTOMER_REPLY_UNVERIFIED');
  return {lead,message};
 }
 async function create(from,to,opportunityId,evidenceRef){const handoffId=relayId(from,to,opportunityId,evidenceRef);const result=await store.create({handoffId,opportunityId,from,to,owner:to,reason:'Verified written customer case for the next existing sales agent',evidenceRef});await command(['SADD',inbox(to),handoffId]);return result.record;}
 async function pending(role){const ids=await command(['SMEMBERS',inbox(role)]);if(!Array.isArray(ids)||ids.length>1000)fail('RELAY_INBOX_REVIEW_REQUIRED');const rows=await Promise.all(ids.map(id=>store.read(id)));return rows.filter(r=>r&&r.to===role&&r.owner===role&&['PENDING','ACCEPTED','BLOCKED'].includes(r.state)).slice(0,3);}
 async function accept(h){return h.state==='ACCEPTED'?h:store.transition({handoffId:h.handoffId,expectedVersion:h.version,state:'ACCEPTED',owner:h.owner,evidenceRef:h.evidenceRef});}
 async function complete(h,evidenceRef){return store.transition({handoffId:h.handoffId,expectedVersion:h.version,state:'COMPLETED',owner:h.owner,evidenceRef});}
 async function persistDiagnosis({bootstrapId,runId},h,message,status){
  const current=(await list(WORK)).find(w=>w.id===bootstrapId);if(current?.fields['Execution Run ID']!==runId||current.fields['Execution State']!=='RUNNING')fail('RELAY_EXECUTOR_OWNERSHIP_LOST');
  const begin=`[RSI02_CASE:${h.handoffId}]`,end=`[/RSI02_CASE:${h.handoffId}]`;
  const body={opportunityId:h.opportunityId,handoffId:h.handoffId,qualificationMessageId:message.id,threadId:message.threadId,customerStatement:message.text.slice(0,5000),status,problemConfirmed:false,next:'Use the actual customer statement to define the scope; an individually signed Director approval is required before closing.'};
  const previous=current.fields.Evidence||'',block=`${begin}\n${JSON.stringify(body)}\n${end}`,start=previous.indexOf(begin),finish=previous.indexOf(end,start);
  if(start>=0&&finish<start)fail('RELAY_DIAGNOSIS_RECONCILIATION_REQUIRED');
  const evidence=start>=0?previous.slice(0,start)+block+previous.slice(finish+end.length):`${previous}\n${block}`;
  await request(WORK,{method:'PATCH',body:{records:[{id:bootstrapId,fields:{Evidence:evidence,'Next Action':status==='WAITING_DIRECTOR_APPROVAL'?'Dirección: approve an individual scope, documented costs and technical evidence for the verified customer case.':'RSI-03: consume the approved case in the existing cycle.'}}]}});
  const saved=(await list(WORK)).find(w=>w.id===bootstrapId);if(saved?.fields.Evidence!==evidence)fail('RELAY_DIAGNOSIS_WRITE_UNCONFIRMED');
 }
 async function run(role,context={}){
  const results=[];if(role==='RSI-01'){
   const replies=(context.followup?.results||[]).filter(r=>r.state==='CUSTOMER_REPLY'&&r.opportunityId&&r.evidenceRef);
   if(!replies.length)return {role,results};await gmail.verify();
   for(const reply of replies){await qualified({opportunityId:reply.opportunityId,evidenceRef:reply.evidenceRef},context.leads);const h=await create('RSI-01','RSI-02',reply.opportunityId,reply.evidenceRef);results.push({opportunityId:h.opportunityId,handoffId:h.handoffId,state:h.state,to:'RSI-02'});}
   return {role,results};
  }
  const rows=await pending(role);if(!rows.length)return {role,results};await gmail.verify();
  const leads=await list(LEADS),work=await list(WORK);
  for(let h of rows){
   if(role==='RSI-02'){
    if(h.from!=='RSI-01')fail('RELAY_SOURCE_MISMATCH');const {message}=await qualified(h,leads);h=await accept(h);
    const candidates=work.filter(w=>w.fields.RSI==='RSI-03'&&String(w.fields.Authorization||'').includes('RSI03_CLOSE_APPROVED'));
    let approved;
    for(const row of candidates){let raw;try{raw=JSON.parse(row.fields.Authorization);}catch{continue;}if(raw.opportunityId!==h.opportunityId||raw.qualificationMessageId!==message.id)continue;const a=validateClosingApproval(row,env,Date.parse(now()));if(a.customerEmail.toLowerCase()!==message.from)fail('RELAY_APPROVED_CUSTOMER_MISMATCH');if(approved)fail('RELAY_MULTIPLE_APPROVED_CASES');approved=row;}
    await persistDiagnosis(context,h,message,approved?'APPROVED_CASE_READY':'WAITING_DIRECTOR_APPROVAL');
    if(!approved){results.push({opportunityId:h.opportunityId,state:'WAITING_DIRECTOR_APPROVAL',handoffId:h.handoffId});continue;}
    const next=await create('RSI-02','RSI-03',h.opportunityId,approved.id);await complete(h,approved.id);results.push({opportunityId:h.opportunityId,state:'TRANSFERRED_TO_RSI03',handoffId:next.handoffId,to:'RSI-03'});
   }else if(role==='RSI-03'){
    if(h.from!=='RSI-02')fail('RELAY_SOURCE_MISMATCH');const row=work.find(w=>w.id===h.evidenceRef);if(!row)fail('RELAY_APPROVED_CASE_MISSING');const a=validateClosingApproval(row,env,Date.parse(now()));if(a.opportunityId!==h.opportunityId)fail('RELAY_APPROVED_CASE_MISMATCH');
    await qualified({opportunityId:h.opportunityId,evidenceRef:a.qualificationMessageId},leads);h=await accept(h);
    if(!registerClosing)fail('RELAY_CLOSING_ADAPTER_MISSING');const registered=await registerClosing(row);if(registered.opportunityId!==h.opportunityId||registered.approvalRecordId!==row.id)fail('RELAY_CLOSING_REGISTRATION_UNVERIFIED');
    await complete(h,row.id);results.push({opportunityId:h.opportunityId,state:'RSI03_CASE_REGISTERED',handoffId:h.handoffId});
   }else fail('RELAY_OWNER_INVALID');
  }
  return {role,results};
 }
 return {run};
}

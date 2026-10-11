import crypto from 'node:crypto';
import {redisCommand,createHandoffStore} from './rsi_handoff_store.js';
import {acceptanceBody} from './customer_acceptance.js';
import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
import {getOrderByOrderId} from './payment_store.js';
import {checkWompiConnection,getWompiTransaction,summarizeWompiTransaction} from './payment_providers.js';
import {createInteragentCoordinator} from './interagent_coordinator.js';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const text=(v,max=500)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(v);
const addresses=v=>String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[];
const money=v=>Number.isFinite(v)&&v>=1&&v<=100000&&Math.abs(v*100-Math.round(v*100))<0.000001;
export function signClosingApproval(payload,key){return crypto.createHmac('sha256',key).update(JSON.stringify(canonical(payload))).digest('hex');}
export function validateClosingApproval(row,env=process.env,now=Date.now(),{allowExpired=false}={}){
 let signed,keys;try{signed=JSON.parse(row.fields.Authorization);keys=JSON.parse(env.INTERAGENT_ROLE_KEYS||'');}catch{fail('CLOSE_APPROVAL_NOT_CONFIGURED');}
 const {signature,...a}=signed;const expected=keys.DIRECTORA&&signClosingApproval(a,keys.DIRECTORA);
 if(!expected||typeof signature!=='string'||signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))fail('CLOSE_DIRECTOR_SIGNATURE_REQUIRED');
 if(a.kind!=='RSI03_CLOSE_APPROVED'||a.approvedBy!=='DIRECTORA'||a.approvalRecordId!==row.id||row.fields.RSI!=='RSI-03'||!/^rec[a-zA-Z0-9]{14}$/.test(a.opportunityId||'')||!/^rec[a-zA-Z0-9]{14}$/.test(row.id||'')||!id(a.quoteReference)||!['prebuilt','custom'].includes(a.productId)||!money(a.totalAmountUsd)||!money(a.approvedAmountUsd)||a.approvedAmountUsd>a.totalAmountUsd||!/^([^\s@<>]+)@([^\s@<>]+)\.[^\s@<>]+$/.test(a.customerEmail||''))fail('CLOSE_SCOPE_INVALID');
 if(!Number.isFinite(Date.parse(a.approvedAt))||Date.parse(a.approvedAt)>now+60000||!Number.isFinite(Date.parse(a.expiresAt))||(!allowExpired&&Date.parse(a.expiresAt)<=now))fail('CLOSE_APPROVAL_EXPIRED');
 if(!text(a.scope?.summary,2000)||!Number.isInteger(a.scope.deliveryDays)||a.scope.deliveryDays<1||a.scope.deliveryDays>365||!Array.isArray(a.scope.acceptanceCriteria)||!a.scope.acceptanceCriteria.length||!a.scope.acceptanceCriteria.every(v=>text(v,500))||!Array.isArray(a.scope.exclusions)||!a.scope.exclusions.every(v=>text(v,500))||!id(a.technicalEvidenceRef)||!id(a.accessEvidenceRef)||!id(a.qualificationMessageId))fail('CLOSE_TECHNICAL_SCOPE_REQUIRED');
 if(!Number.isFinite(a.costs?.totalUsd)||a.costs.totalUsd<0||a.costs.totalUsd>=a.totalAmountUsd||a.costs.currency!=='USD'||!id(a.costs.evidenceRef))fail('CLOSE_DOCUMENTED_COSTS_REQUIRED');
 return a;
}
export function isExplicitAcceptance(message,record){
 return message.from===record.approval.customerEmail.toLowerCase()&&!message.sent&&!message.automatic&&message.threadId===record.threadId&&Number.isFinite(Date.parse(message.receivedAt))&&Date.parse(message.receivedAt)>=Date.parse(record.proposal.sentAt)&&Date.parse(message.receivedAt)<=Date.parse(record.approval.expiresAt)&&acceptanceBody(message.text)===record.acceptanceToken;
}
async function crmLead(recordId){
 const token=process.env.AIRTABLE_TOKEN||process.env.AIRTABLE_PAT;if(!token)fail('CLOSE_CRM_NOT_CONFIGURED');
 const r=await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID||'appCQZd0IhBHFoZ9P'}/tblZaox2MX5uYA5PZ/${recordId}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
 if(!r.ok)fail('CLOSE_CRM_UNAVAILABLE');return r.json();
}
async function createApprovedCheckout(approval){
 const token=process.env.PARTNER_API_TOKEN||process.env.COCKPIT_ACCESS_TOKEN;if(!token)fail('CLOSE_PAYMENT_AUTH_NOT_CONFIGURED');
 let r;try{r=await fetch('https://boltech-group.vercel.app/api/payments?action=create-approved',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({provider:'WOMPI_SV',approved:true,productId:approval.productId,approvedAmountUsd:approval.approvedAmountUsd,quoteReference:approval.quoteReference,customerEmail:approval.customerEmail,quantity:1}),signal:AbortSignal.timeout(25000)});}catch{fail('CLOSE_CHECKOUT_UNKNOWN');}
 let body;try{body=await r.json();}catch{fail('CLOSE_CHECKOUT_UNKNOWN');}
 if(!r.ok||!body.success)fail(body.code||'CLOSE_CHECKOUT_REJECTED');return body;
}
async function verifyProductionPayment(order,approval){
 if(order?.status!=='PAID'||order.environment!=='production'||order.provider!=='WOMPI_SV'||order.productId!==approval.productId||order.customerEmail.toLowerCase()!==approval.customerEmail.toLowerCase()||order.expectedAmountUsd!==approval.approvedAmountUsd||!order.providerTransactionId||!order.providerEvidence||!order.paidAt)return false;
 const tx=summarizeWompiTransaction(await getWompiTransaction(order.providerTransactionId));
 return tx.approved===true&&tx.real===true&&tx.id===order.providerTransactionId&&Number.isFinite(tx.amount)&&Math.abs(tx.amount-order.expectedAmountUsd)<0.005;
}
export function createRsi03Closing({command=redisCommand,gmail=createSdrGmail(),lead=crmLead,checkout=createApprovedCheckout,order=getOrderByOrderId,gateway=checkWompiConnection,verifyPayment=verifyProductionPayment,coordinator=createInteragentCoordinator(),handoff=async input=>{const result=await createHandoffStore(command,()=>now().toISOString()).create(input);await command(['SADD',`boltech:rsi:commercial:inbox:${input.to}`,input.handoffId]);return result;},env=process.env,now=()=>new Date()}={}){
 const key=opportunityId=>`boltech:closing:case:${opportunityId}`;
 const read=async k=>{const raw=await command(['GET',k]);return raw?JSON.parse(raw):null;};
 async function register(row){
  let opportunityId;try{opportunityId=JSON.parse(row.fields.Authorization).opportunityId;}catch{fail('CLOSE_SCOPE_INVALID');}
  if(!/^rec[a-zA-Z0-9]{14}$/.test(opportunityId||''))fail('CLOSE_SCOPE_INVALID');
  const k=key(opportunityId),existing=await read(k);
  const a=validateClosingApproval(row,env,now().getTime(),{allowExpired:!!existing}),fingerprint=hash(a);
  if(existing){if(existing.fingerprint!==fingerprint)fail('CLOSE_CASE_CONFLICT');return existing;}
  const account=await lead(a.opportunityId),f=account?.fields||{};
  if(account?.id!==a.opportunityId||String(f['Contact Email']).toLowerCase()!==a.customerEmail.toLowerCase()||/cliente\s+sint[eé]tico/i.test(String(f.Name||''))||f['Data Quality']==='QA'||f.Unsubscribed||f['Do Not Contact']||/\[RSI01_FOLLOWUP:[a-f0-9]{64}:(?:SUPPRESSED|BOUNCED)\]/.test(f.Notes||'')||/bounced|disqualified|unsubscribed/i.test([f.Status,f['Commercial Stage'],f['Data Quality']].join(' ')))fail('CLOSE_ACCOUNT_MISMATCH_OR_EXCLUDED');
  await gmail.verify();const evidence=await gmail.message(a.qualificationMessageId);
  if(evidence.from!==a.customerEmail.toLowerCase()||evidence.sent||evidence.automatic||!evidence.to.toLowerCase().includes(SDR_SENDER)||!evidence.text?.trim()||!evidence.rfcMessageId)fail('CLOSE_CUSTOMER_EVIDENCE_UNVERIFIED');
  const connected=await gateway();if(connected.status!=='PASSED'||connected.productive!==true)fail('CLOSE_GATEWAY_PRODUCTION_UNVERIFIED');
  const record={opportunityId:a.opportunityId,approval:a,fingerprint,approvalRecordId:row.id,state:'APPROVED',createdAt:now().toISOString(),threadId:evidence.threadId,subject:evidence.subject||'Propuesta Boltech',inReplyTo:evidence.rfcMessageId,acceptanceToken:`ACEPTO BOLTECH-${hash(a).slice(0,12).toUpperCase()}`,orderId:'quote-'+crypto.createHash('sha256').update(a.quoteReference).digest('hex'),history:[]};
  if(await command(['SET',k,JSON.stringify(record),'NX'])!=='OK'){const concurrent=await read(k);if(concurrent?.fingerprint!==fingerprint)fail('CLOSE_CASE_CONFLICT');return concurrent;}
  return record;
 }
 async function step(opportunityId){
  const k=key(opportunityId),lock=k+':lock',lease=crypto.randomUUID();
  if(await command(['SET',lock,lease,'NX','PX',90000])!=='OK')fail('CLOSE_CASE_BUSY');
  let record;
  const save=async(next,action)=>{
   next={...next,updatedAt:now().toISOString(),history:[...(record?.history||[]),{at:now().toISOString(),action,state:next.state}]};
   if(await command(['EVAL',"if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 'LEASE_LOST' end;redis.call('SET',KEYS[2],ARGV[2]);return 'OK'",2,lock,k,lease,JSON.stringify(next)])!=='OK')fail('CLOSE_LEASE_LOST');
   record=next;return next;
  };
  try{
   record=await read(k);if(!record)fail('CLOSE_CASE_NOT_FOUND');
   const a=record.approval;
   async function send(kind,body){
    const rfcMessageId=`boltech-close-${hash({opportunityId,quote:a.quoteReference,kind})}@boltech-group.vercel.app`;
    if(record[kind]?.state==='SENT')return record[kind];
    if(['SEND_PENDING','UNKNOWN'].includes(record[kind]?.state)){
     const found=await gmail.search(`in:sent rfc822msgid:${rfcMessageId}`);
     if(found.length!==1)fail('CLOSE_SEND_RECONCILIATION_REQUIRED');
     const actual=await gmail.message(found[0].id);
     if(actual?.id!==found[0].id||!actual.sent||actual.automatic||actual.from!==SDR_SENDER||!addresses(actual.to).includes(a.customerEmail.toLowerCase())||actual.threadId!==record.threadId||String(actual.rfcMessageId||'').replace(/[<>]/g,'')!==rfcMessageId||!actual.text?.includes(body)||!Number.isFinite(Date.parse(actual.receivedAt))||Date.parse(actual.receivedAt)<Date.parse(record[kind].claimedAt)||Date.parse(actual.receivedAt)>now().getTime()+60000)fail('CLOSE_SEND_RECONCILIATION_REQUIRED');
     await save({...record,[kind]:{state:'SENT',messageId:actual.id,threadId:actual.threadId,sentAt:actual.receivedAt}},'SEND_RECONCILED');return record[kind];
    }
    const local=new Date(now().getTime()-6*3600000);
    if(local.getUTCDay()===0||local.getUTCDay()===6||local.getUTCHours()<9||local.getUTCHours()>=17)fail('CLOSE_OUTSIDE_SEND_WINDOW');
    if(Date.parse(a.expiresAt)<=now().getTime())fail('CLOSE_APPROVAL_EXPIRED');
    await gmail.verify();
    const current=await lead(opportunityId),f=current?.fields||{};
    if(String(f['Contact Email']).toLowerCase()!==a.customerEmail.toLowerCase()||f['Do Not Contact']||f.Unsubscribed||/\[RSI01_FOLLOWUP:[a-f0-9]{64}:(?:SUPPRESSED|BOUNCED)\]/.test(f.Notes||'')||/bounced|disqualified|unsubscribed/i.test([f.Status,f['Commercial Stage'],f['Data Quality']].join(' ')))fail('CLOSE_CONTACT_HOLD');
    const mailboxLease=crypto.randomUUID();
    if(await command(['SET','boltech:sdr:mailbox-lease',mailboxLease,'NX','PX',60000])!=='OK')fail('CLOSE_MAILBOX_BUSY');
    try{
     const [daily,hourly]=await Promise.all([gmail.search('in:sent newer_than:1d'),gmail.search('in:sent newer_than:1h')]);
     if(daily.length>=100||hourly.length>=20)fail('CLOSE_MAILBOX_CAPACITY_HOLD');
     await save({...record,[kind]:{state:'SEND_PENDING',rfcMessageId,claimedAt:now().toISOString()}},'SEND_CLAIMED');
     let receipt;try{receipt=await gmail.send({email:a.customerEmail,subject:/^Re:/i.test(record.subject)?record.subject:`Re: ${record.subject}`,text:body,rfcMessageId,threadId:record.threadId,inReplyTo:record.inReplyTo});}catch(error){await save({...record,[kind]:{...record[kind],state:'UNKNOWN',code:error.code||'GMAIL_SEND_UNKNOWN'}},'SEND_UNCONFIRMED');throw error;}
     await save({...record,[kind]:{state:'SENT',...receipt,sentAt:now().toISOString()}},'SEND_CONFIRMED');return record[kind];
    }finally{await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,'boltech:sdr:mailbox-lease',mailboxLease]);}
   }
   if(record.state==='APPROVED'){
    const validity=new Intl.DateTimeFormat('es-SV',{timeZone:'America/El_Salvador',dateStyle:'medium',timeStyle:'short'}).format(new Date(a.expiresAt));
    const body=`Propuesta ${a.quoteReference}\n\n${a.scope.summary}\n\nPrecio total: USD${a.totalAmountUsd}. Este cobro: USD${a.approvedAmountUsd}. Plazo: ${a.scope.deliveryDays} días desde aceptación y accesos verificados. Vigencia: ${validity}, hora de El Salvador.\nCriterios: ${a.scope.acceptanceCriteria.join('; ')}.\nExclusiones: ${a.scope.exclusions.join('; ')||'Según alcance aprobado'}.\n\nSi acepta este alcance y estos importes, responda únicamente: ${record.acceptanceToken}\nNo iniciaremos ni consideraremos pagado el trabajo por enviar esta propuesta.`;
    await send('proposal',body);await save({...record,state:'PROPOSAL_SENT'},'PROPOSAL_SENT');
   }else if(record.state==='PROPOSAL_SENT'){
    const messages=await gmail.thread(record.threadId),accepted=messages.filter(m=>isExplicitAcceptance(m,record));
    if(accepted.length){const latest=accepted.sort((x,y)=>Date.parse(y.receivedAt)-Date.parse(x.receivedAt))[0];await save({...record,state:'ACCEPTED',acceptanceMessageId:latest.id,acceptanceAt:latest.receivedAt,inReplyTo:latest.rfcMessageId||record.inReplyTo},'CUSTOMER_ACCEPTANCE_VERIFIED');}
    else{
     const reply=messages.filter(m=>m.from===a.customerEmail.toLowerCase()&&!m.sent&&!m.automatic&&m.threadId===record.threadId&&Date.parse(m.receivedAt)>=Date.parse(record.proposal.sentAt)&&m.text?.trim()).sort((x,y)=>Date.parse(y.receivedAt)-Date.parse(x.receivedAt))[0];
     if(reply&&record.qualificationHandoffMessageId!==reply.id){
      await handoff({handoffId:`clarify-${hash({opportunityId,messageId:reply.id}).slice(0,48)}`,opportunityId,from:'RSI-03',to:'RSI-02',owner:'RSI-02',reason:'Customer response requires clarification of the approved written scope; no payment authorization inferred.',evidenceRef:reply.id});
      await save({...record,qualificationHandoffMessageId:reply.id},'CUSTOMER_RESPONSE_HANDOFF_RSI02');
     }
    }
   }else if(['ACCEPTED','CHECKOUT_PENDING','CHECKOUT_UNKNOWN'].includes(record.state)){
    let existing=await order(record.orderId);
    if(!existing&&record.state==='ACCEPTED'){
     if(Date.parse(a.expiresAt)<=now().getTime())fail('CLOSE_APPROVAL_EXPIRED');
     await save({...record,state:'CHECKOUT_PENDING'},'CHECKOUT_CLAIMED');
     try{await checkout(a);}catch(error){await save({...record,state:'CHECKOUT_UNKNOWN',blocker:error.code||'CLOSE_CHECKOUT_UNKNOWN'},'CHECKOUT_UNCONFIRMED');throw error;}
     existing=await order(record.orderId);
    }
    if(!existing||!['PENDING_PAYMENT','PAID'].includes(existing.status)||!existing.providerCheckoutUrl)fail('CLOSE_CHECKOUT_RECONCILIATION_REQUIRED');
    if(existing.customerEmail.toLowerCase()!==a.customerEmail.toLowerCase()||existing.expectedAmountUsd!==a.approvedAmountUsd||existing.productId!==a.productId||existing.environment!=='production'||existing.provider!=='WOMPI_SV')fail('CLOSE_ORDER_ACCOUNT_MISMATCH');
    let url;try{url=new URL(existing.providerCheckoutUrl);}catch{fail('CLOSE_CHECKOUT_URL_INVALID');}
    if(url.protocol!=='https:'||!/(^|\.)wompi\.sv$/.test(url.hostname)||url.username||url.password)fail('CLOSE_CHECKOUT_URL_INVALID');
    await save({...record,state:existing.status==='PAID'?'WAITING_PAYMENT':'PAYMENT_LINK_READY',checkoutUrl:url.href},'CHECKOUT_VERIFIED');
   }else if(record.state==='PAYMENT_LINK_READY'){
    await send('paymentLink',`Gracias por aceptar la propuesta ${a.quoteReference}.\nCobro aprobado: USD${a.approvedAmountUsd}.\n${record.checkoutUrl}\n\nEl pago se confirmará con el proveedor. Conserve la referencia; no envíe datos de tarjeta por correo.`);
    await save({...record,state:'WAITING_PAYMENT'},'PAYMENT_LINK_SENT');
   }else if(record.state==='WAITING_PAYMENT'){
    const paid=await order(record.orderId);
    if(paid?.status==='PAID'){
     if(!await verifyPayment(paid,a))fail('CLOSE_PROVIDER_PAYMENT_UNVERIFIED');
     const result=await coordinator.submit({eventId:`close-${hash({opportunityId,orderId:record.orderId}).slice(0,48)}`,opportunityId,from:'RSI-03',type:'CLOSE_REPORTED',orderId:record.orderId,acceptanceRef:record.acceptanceMessageId});
     if(!result.success)fail('CLOSE_DIRECTOR_QUEUE_UNCONFIRMED');
     await save({...record,state:'DIRECTOR_REVIEW',closureEventId:result.eventId,paymentVerifiedAt:now().toISOString()},'VERIFIED_PAYMENT_REPORTED_TO_DIRECTOR');
    }
   }
   return {success:true,opportunityId,state:record.state,approvalRecordId:record.approvalRecordId,customerAcceptanceVerified:!!record.acceptanceMessageId,paymentVerified:!!record.paymentVerifiedAt,ricardoNotified:false};
  }finally{await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,lock,lease]);}
 }
 async function runNext(work){
  const candidates=work.filter(r=>r.fields?.RSI==='RSI-03'&&String(r.fields.Authorization||'').includes('RSI03_CLOSE_APPROVED'));
  if(!candidates.length)return {state:'WAITING_QUALIFIED_APPROVED_CASE',processed:0,externalSendingImplemented:true,modelCalls:0};
  // Round robin prevents a waiting customer from starving another opportunity.
  const cursorKey='boltech:closing:cursor',cursor=Number(await command(['GET',cursorKey])||0);
  if(!Number.isSafeInteger(cursor)||cursor<0)fail('CLOSE_CURSOR_INVALID');
  for(let i=0;i<candidates.length;i++){
   const position=(cursor+i)%candidates.length,row=candidates[position];
   await command(['SET',cursorKey,String((position+1)%candidates.length)]);
   try{const record=await register(row);if(record.state==='DIRECTOR_REVIEW')continue;return {...await step(record.opportunityId),processed:1,modelCalls:0};}catch(error){return {state:'BLOCKED',processed:0,code:error.code||'CLOSE_TOOL_UNAVAILABLE',modelCalls:0};}
  }
  return {state:'ALL_CASES_IN_DIRECTOR_REVIEW',processed:0,modelCalls:0};
 }
 async function readiness(){
  const results=await Promise.allSettled([gmail.verify(),gateway(),command(['PING'])]);
  let keys;try{keys=JSON.parse(env.INTERAGENT_ROLE_KEYS||'');}catch{}
  const checks={gmail:results[0].status==='fulfilled'&&results[0].value.verified===true,wompiProduction:results[1].status==='fulfilled'&&results[1].value.status==='PASSED'&&results[1].value.productive===true,storage:results[2].status==='fulfilled'&&results[2].value==='PONG',directorSignatureConfigured:!!keys?.DIRECTORA,approvedQuoteAuthConfigured:!!(env.PARTNER_API_TOKEN||env.COCKPIT_ACCESS_TOKEN)};
  return {engineVersion:1,status:Object.values(checks).every(Boolean)?'CONNECTIONS_VERIFIED':'BLOCKED',checks,modelsEnabled:false,modelCalls:0,customerCaseVerified:false,saleInferred:false,policy:'Only signed, individually approved scopes with actual CRM/Gmail evidence; acceptance and provider payment checked server-side'};
 }
 return {register,step,runNext,readiness};
}

import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {join} from 'node:path';
import {supportReply} from './customer_support_policy.js';

const fail = code => {throw Object.assign(Error(code), {code});};
const syntheticId = value => typeof value==='string' && /^SYN_[A-Z0-9_]{1,80}$/.test(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const timestamp = () => new Date().toISOString();
export const PDRO_PROFILE = Object.freeze({
  tenantId:'SYN_PDRO_IMPORTS', orderId:'SYN_PDRO_IMPORTS_001', customer:'Pedro', company:'Pdro Imports',
  phoneNumberId:'SYN_PHONE_PDRO', mode:'SYNTHETIC_ONLY', channel:'WHATSAPP_SANDBOX',
  scope:['Atención de mensajes entrantes en español','Captura de consultas de productos','Solicitud de referencia de pedido','Casos y transferencia a Pedro'],
  forbidden:['Inventar precios, stock, horarios o estados de pedidos','Cobrar o devolver dinero','Iniciar campañas o seguimientos no solicitados','Enviar mensajes reales desde esta prueba'],
  knowledge:{catalog:null, prices:null, hours:null, address:null, orderSystem:null},
  llmVerified:false, metaConnected:false
});

// One local sandbox process serializes transactions; atomic rename persists each
// complete change. This is not a shared multi-worker production database.
export function createSandboxStore(directory) {
  let pending=Promise.resolve();
  async function transaction(change) {
    const run=pending.then(async()=>{
      await mkdir(directory,{recursive:true,mode:0o700});
      const path=join(directory,'state.json');let state;
      try{state=JSON.parse(await readFile(path,'utf8'));}
      catch(error){if(error.code!=='ENOENT')throw error;state={schemaVersion:1,mode:'SYNTHETIC_ONLY',tenants:{}};}
      if(state.mode!=='SYNTHETIC_ONLY')fail('SYNTHETIC_STORE_REQUIRED');
      const output=await change(state);
      await writeFile(path+'.tmp',JSON.stringify(state,null,2),{mode:0o600});
      await rename(path+'.tmp',path);return structuredClone(output);
    });
    pending=run.catch(()=>{});return run;
  }
  return {transaction};
}

export function createCustomerSandbox({store,profile=PDRO_PROFILE,appSecret,verifyToken}={}) {
  if(!store?.transaction || profile.mode!=='SYNTHETIC_ONLY' || !syntheticId(profile.tenantId) || !syntheticId(profile.phoneNumberId))fail('SYNTHETIC_CONFIGURATION_REQUIRED');
  if(typeof appSecret!=='string'||appSecret.length<24 || typeof verifyToken!=='string'||verifyToken.length<24)fail('SANDBOX_AUTH_REQUIRED');
  const stateFor=state=>{
    const tenant=state.tenants[profile.tenantId];if(!tenant)fail('SYNTHETIC_ORDER_REQUIRED');return tenant;
  };
  const append=(tenant,type,detail={})=>tenant.events.push({sequence:tenant.events.length+1,type,at:timestamp(),...detail});
  async function provision() {
    return store.transaction(state=>{
      const existing=state.tenants[profile.tenantId];
      if(existing){if(existing.profileDigest!==hash(profile))fail('SCOPE_CONFLICT');return existing.order;}
      const tenant=state.tenants[profile.tenantId]={profileDigest:hash(profile),profile,conversations:{},messages:{},outbox:[],tickets:[],events:[]};
      tenant.order={orderId:profile.orderId,tenantId:profile.tenantId,customer:profile.customer,company:profile.company,
        kind:'SYNTHETIC_ONLY',scope:profile.scope,payment:{status:'PAID_IN_FULL_SIMULATED',source:'USER_DECLARED_FICTITIOUS_SCENARIO',realRevenue:false,amount:null,providerTransactionId:null},
        configuration:'CONFIGURED_IN_SANDBOX',channel:'WHATSAPP_SANDBOX',metaConnected:false,aiInferenceVerified:false,
        delivery:'NOT_DELIVERED',customerAcceptance:'PENDING',createdAt:timestamp()};
      append(tenant,'ORDER_REGISTERED');append(tenant,'PAYMENT_DECLARED_SIMULATED');
      append(tenant,'SCOPE_RECORDED',{scope:profile.scope});append(tenant,'TENANT_PROVISIONED');append(tenant,'AGENT_CONFIGURED');
      return tenant.order;
    });
  }
  async function receive(raw,signature) {
    if(!Buffer.isBuffer(raw)||raw.length>16384)fail('WEBHOOK_BODY_INVALID');
    const expected='sha256='+createHmac('sha256',appSecret).update(raw).digest('hex');
    if(typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))fail('INVALID_META_SIGNATURE');
    let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{fail('INVALID_JSON');}
    if(payload.object!=='whatsapp_business_account'||!Array.isArray(payload.entry)||payload.entry.length!==1)fail('WEBHOOK_PAYLOAD_INVALID');
    const changes=payload.entry[0]?.changes;
    if(!Array.isArray(changes)||changes.length!==1||changes[0].field!=='messages')fail('WEBHOOK_PAYLOAD_INVALID');
    const value=changes[0].value;
    if(value?.metadata?.phone_number_id!==profile.phoneNumberId)fail('TENANT_PHONE_MISMATCH');
    if(value.statuses && !value.messages)return {received:true,ignored:'STATUS_NOTIFICATION',realMessageSent:false};
    if(!Array.isArray(value.messages)||value.messages.length!==1)fail('ONE_SYNTHETIC_MESSAGE_REQUIRED');
    const message=value.messages[0];
    if(!syntheticId(message.id)||!syntheticId(message.from))fail('SYNTHETIC_IDENTIFIERS_REQUIRED');
    return store.transaction(state=>{
      const tenant=stateFor(state),digest=hash(message),existing=tenant.messages[message.id];
      if(existing){if(existing.digest!==digest)fail('MESSAGE_ID_CONFLICT');return {...existing.result,duplicate:true};}
      if(Object.keys(tenant.messages).length>=200)fail('SANDBOX_MESSAGE_LIMIT');
      const conversation=tenant.conversations[message.from]||{lastIntent:null,handoff:false,optOut:false,messages:[]};
      const text=message.type==='text'?message.text?.body:null;
      if(message.type==='text'&&(typeof text!=='string'||!text.trim()||text.length>2000))fail('MESSAGE_TEXT_INVALID');
      const decision=message.type==='text'?supportReply(text,conversation,profile.knowledge):{
        reply:'Recibí un archivo o mensaje que este agente de prueba todavía no puede interpretar. ¿Puedes describirlo por escrito? Dejaré el caso para Pedro.',intent:'UNSUPPORTED_MEDIA',handoff:true,mode:'SAFE_TRIAGE_RULES'};
      let ticketId=null;
      if(decision.handoff){
        const ticket=tenant.tickets.find(t=>t.sender===message.from&&t.status==='OPEN');
        if(ticket){ticketId=ticket.id;ticket.messageIds.push(message.id);if(decision.priority==='HIGH')ticket.priority='HIGH';}
        else{ticketId='SYN_TICKET_'+String(tenant.tickets.length+1).padStart(4,'0');tenant.tickets.push({id:ticketId,sender:message.from,status:'OPEN',priority:decision.priority||'NORMAL',messageIds:[message.id],owner:profile.customer});}
      }
      conversation.lastIntent=decision.intent;conversation.handoff ||= !!decision.handoff;conversation.optOut ||= !!decision.optOut;
      conversation.messages.push({id:message.id,text:text||'[unsupported media]',reply:decision.reply,intent:decision.intent,ticketId});
      tenant.conversations[message.from]=conversation;
      const captured={id:'SYN_REPLY_'+String(tenant.outbox.length+1).padStart(4,'0'),inReplyTo:message.id,to:message.from,text:decision.reply,status:'CAPTURED_IN_SANDBOX',realMessageSent:false};
      tenant.outbox.push(captured);
      const result={received:true,reply:decision.reply,intent:decision.intent,ticketId,outboxId:captured.id,mode:'SYNTHETIC_ONLY',realMessageSent:false,duplicate:false};
      tenant.messages[message.id]={digest,result};append(tenant,'INBOUND_PROCESSED',{messageId:message.id,intent:decision.intent,ticketId});
      return result;
    });
  }
  async function snapshot(){return store.transaction(state=>stateFor(state));}
  // Trusted local owner operation only. Not exposed by the public webhook.
  async function resolveTicket(ticketId,{note}={}) {
    if(!syntheticId(ticketId)||typeof note!=='string'||!note.trim()||note.length>1000)fail('RESOLUTION_REQUIRED');
    return store.transaction(state=>{
      const tenant=stateFor(state),ticket=tenant.tickets.find(t=>t.id===ticketId);
      if(!ticket)fail('TICKET_NOT_FOUND');
      if(ticket.status==='RESOLVED'){
        if(ticket.resolution.note!==note.trim())fail('RESOLUTION_CONFLICT');
        return ticket;
      }
      ticket.status='RESOLVED';ticket.resolution={note:note.trim(),actor:profile.customer,at:timestamp(),externalNotificationSent:false};
      const conversation=tenant.conversations[ticket.sender];
      conversation.handoff=false;conversation.lastIntent=null;
      append(tenant,'CASE_RESOLVED',{ticketId,actor:profile.customer});return ticket;
    });
  }
  async function deliverForReview(qa) {
    if(qa?.passed!==true||!Number.isSafeInteger(qa.testsPassed)||qa.testsPassed<1||!/^[a-f0-9]{64}$/.test(qa.artifactDigest||''))fail('QA_EVIDENCE_REQUIRED');
    return store.transaction(state=>{
      const tenant=stateFor(state);tenant.order.qa={...qa,kind:'LOCAL_SYNTHETIC_TESTS',at:timestamp()};
      tenant.order.delivery='SANDBOX_DELIVERED_FOR_REVIEW';
      tenant.order.productionStatus='BLOCKED_META_AND_BUSINESS_ONBOARDING';
      append(tenant,'SANDBOX_DELIVERED_FOR_REVIEW',{artifactDigest:qa.artifactDigest});return tenant.order;
    });
  }
  async function fetchRequest(request) {
    const url=new URL(request.url);
    if(url.pathname!=='/webhook')return Response.json({success:false,error:'NOT_FOUND'},{status:404});
    if(request.method==='GET'){
      const supplied=url.searchParams.get('hub.verify_token')||'';
      if(url.searchParams.get('hub.mode')!=='subscribe'||Buffer.byteLength(supplied)!==Buffer.byteLength(verifyToken)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(verifyToken)))return new Response(null,{status:403});
      const challenge=url.searchParams.get('hub.challenge')||'';
      if(!/^[A-Za-z0-9_-]{1,200}$/.test(challenge))return new Response(null,{status:400});
      return new Response(challenge,{headers:{'Cache-Control':'no-store'}});
    }
    if(request.method!=='POST')return new Response(null,{status:405});
    const size=Number(request.headers.get('Content-Length'));if(size>16384)return new Response(null,{status:413});
    try{
      const reader=request.body?.getReader();if(!reader)fail('WEBHOOK_BODY_INVALID');
      const parts=[];let total=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>16384)fail('WEBHOOK_BODY_INVALID');parts.push(Buffer.from(value));}}
      finally{await reader.cancel().catch(()=>{});}
      return Response.json(await receive(Buffer.concat(parts),request.headers.get('X-Hub-Signature-256')),{headers:{'Cache-Control':'no-store'}});
    }
    catch(error){const safe=['INVALID_META_SIGNATURE','TENANT_PHONE_MISMATCH','SYNTHETIC_IDENTIFIERS_REQUIRED','WEBHOOK_BODY_INVALID','WEBHOOK_PAYLOAD_INVALID','ONE_SYNTHETIC_MESSAGE_REQUIRED','MESSAGE_TEXT_INVALID','MESSAGE_ID_CONFLICT','INVALID_JSON','SANDBOX_MESSAGE_LIMIT'];return Response.json({success:false,error:safe.includes(error.code)?error.code:'SANDBOX_UNAVAILABLE'},{status:error.code==='INVALID_META_SIGNATURE'?403:400});}
  }
  return {provision,receive,snapshot,resolveTicket,deliverForReview,fetch:fetchRequest};
}

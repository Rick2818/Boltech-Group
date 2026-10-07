import crypto from 'node:crypto';
import {redisCommand} from './rsi_handoff_store.js';
import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
import {createInteragentCoordinator} from './interagent_coordinator.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};

// Existing Director responsibility, not a fifth commercial agent. Only Ricardo's
// verified commercial mailbox receives this operational notice; no new sender.
export function createDirectorNotifications({command=redisCommand,gmail=createSdrGmail(),coordinator=createInteragentCoordinator(),now=()=>new Date().toISOString()}={}){
 async function run(){
  const events=(await coordinator.queue('DIRECTORA')).pending.filter(e=>e.type==='CLOSE_REPORTED');
  if(!events.length)return {status:'NO_VERIFIED_CLOSURE_PENDING',notified:0,saleInferred:false};
  const event=events[0],k=`boltech:director:notice:${event.eventId}`,lock=k+':lock',lease=crypto.randomUUID();
  if(await command(['SET',lock,lease,'NX','PX',90000])!=='OK')fail('DIRECTOR_NOTICE_BUSY');
  const read=async()=>{const raw=await command(['GET',k]);return raw?JSON.parse(raw):null;};
  async function save(row){if(await command(['EVAL',"if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 'LEASE_LOST' end;redis.call('SET',KEYS[2],ARGV[2]);return 'OK'",2,lock,k,lease,JSON.stringify(row)])!=='OK')fail('DIRECTOR_NOTICE_LEASE_LOST');return row;}
  try{
   const evidence=await coordinator.verifyClosure(event.eventId);
   await gmail.verify();let receipt=await read();
   const rfcMessageId=`boltech-director-${crypto.createHash('sha256').update(event.eventId).digest('hex')}@boltech-group.vercel.app`;
   if(['SEND_PENDING','UNKNOWN'].includes(receipt?.state)){
    const found=await gmail.search(`in:sent rfc822msgid:${rfcMessageId}`);
    if(found.length!==1)fail('DIRECTOR_NOTICE_RECONCILIATION_REQUIRED');
    receipt=await save({state:'SENT',messageId:found[0].id,threadId:found[0].threadId,reconciledAt:now()});
   }
   if(!receipt){
    const mailboxLease=crypto.randomUUID();
    if(await command(['SET','boltech:sdr:mailbox-lease',mailboxLease,'NX','PX',60000])!=='OK')fail('DIRECTOR_MAILBOX_BUSY');
    try{
     receipt=await save({state:'SEND_PENDING',claimedAt:now(),rfcMessageId});
     const text=`Don Ricardo,\n\nRSI-03 reportó un pago y Dirección verificó la aceptación escrita del cliente y la transacción del proveedor.\nImporte confirmado: USD${evidence.amountUsd}. Total del alcance aprobado: USD${evidence.totalAmountUsd}.\nPedido: ${evidence.orderId}.\nOportunidad: ${evidence.opportunityId}.\nEstado: pago registrado; la entrega sigue su alcance y criterios aprobados.\n\n[BOLTECH_DIRECTOR_NOTICE:${event.eventId}]`;
     let sent;try{sent=await gmail.send({email:SDR_SENDER,subject:`Boltech: pago verificado USD${evidence.amountUsd}`,text,rfcMessageId});}catch(error){await save({...receipt,state:'UNKNOWN',code:error.code||'DIRECTOR_NOTICE_UNKNOWN'});throw error;}
     receipt=await save({state:'SENT',...sent,sentAt:now()});
    }finally{await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,'boltech:sdr:mailbox-lease',mailboxLease]);}
   }
   await coordinator.acknowledge({from:'DIRECTORA',eventId:event.eventId,evidenceRef:event.orderId,verified:true,communicationRef:receipt.messageId});
   await save({...receipt,state:'ACKNOWLEDGED',acknowledgedAt:now()});
   return {status:'RICARDO_NOTICE_VERIFIED',notified:1,eventId:event.eventId,communicationRef:receipt.messageId,channel:'VERIFIED_COMMERCIAL_GMAIL',paymentVerified:true};
  }finally{await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,lock,lease]);}
 }
 return {run};
}

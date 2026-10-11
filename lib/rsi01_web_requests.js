import crypto from 'node:crypto';
import qaCase from '../config/qa_case.json' with {type:'json'};
import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
import {redisCommand} from './rsi_handoff_store.js';
import {sdrWindow} from './sdr_dispatch.js';

const WORK='tblHVqUMifOFjlGvj';
const release="if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0";
export function webRequestExcluded(lead,evidence={}) {
  const f=lead?.fields||{};
  return !lead || String(f['Contact Email']||'').trim().toLowerCase()===qaCase.answers.at(-1).toLowerCase() || f['Data Quality']==='QA' || evidence.requestId===qaCase.requestId || f.Unsubscribed || f['Do Not Contact'] || /unsubscribed|bounced|disqualified|lost|paid verified/i.test([f.Status,f['Commercial Stage'],f.Notes].join(' '));
}
export function webRequestMessage(e,language='es') {
  const en=language==='en';
  return {subject:en?'Your request to Boltech — confirm the process':'Tu solicitud a Boltech — confirma el proceso',
    text:en?`You asked Boltech to review this problem: ${e.painPoint}\nCurrent process: ${e.workflow}\nExpected result: ${e.result}\n\nPlease reply to confirm this request is yours and how you will evaluate the solution. We will review tools, access and limits before approving feasibility or a quote. Do not send passwords or private customer data. If this request was not yours or you do not want further contact, reply STOP.`
    :`Solicitaste a Boltech revisar este problema: ${e.painPoint}\nProceso actual: ${e.workflow}\nResultado esperado: ${e.result}\n\nResponde para confirmar que la solicitud es tuya y cómo evaluarás la solución. Revisaremos herramientas, accesos y límites antes de aprobar viabilidad o cotización. No envíes contraseñas ni datos privados de clientes. Si no hiciste esta solicitud o no deseas contacto, responde STOP.`};
}
// Runs inside RSI-01's existing cycle. One requested response, no cold campaign.
export function createWebRequests({request,command=redisCommand,gmail=createSdrGmail(),now=()=>new Date()}={}) {
  async function persist(row,job){
    const next=job.state==='SENT'?'RSI-01: esperar respuesta al correo verificado; no repetir envío.':job.state==='CUSTOMER_REPLY'?'RSI-02: revisar respuesta verificada y validar alcance.':`RSI-01: ${job.state}; conciliar antes de enviar.`;
    await request(WORK,{method:'PATCH',body:{records:[{id:row.id,fields:{'Next Action':next}}]}});
    const page=await request(WORK,{});
    if(!page.records.some(w=>w.id===row.id&&w.fields['Next Action']===next))throw Error('WEB_ACTION_READBACK_REQUIRED');
  }
  async function run({work=[],leads=[]}={}){
    const results=[],rows=work.filter(w=>w.fields.RSI==='RSI-01'&&String(w.fields['Work ID']||'').startsWith('WEB_INTAKE:')).slice(0,5);
    if(!rows.length)return {results};
    const lock='boltech:sdr:mailbox-lease',lease=crypto.randomUUID();
    if(await command(['SET',lock,lease,'NX','PX',90000])!=='OK')return {results:[{state:'MAILBOX_BUSY'}]};
    try{for(const row of rows){try{
      const e=JSON.parse(row.fields.Evidence||'{}'),lead=leads.find(l=>l.id===row.fields['Source Record ID']);
      if(webRequestExcluded(lead,e)||e.kind!=='RSI01_WEB_INTAKE_V1'||e.consent!==true){results.push({state:'CONTACT_HOLD',workId:row.id});continue;}
      if(!/^[a-f0-9]{64}$/.test(e.requestId)||e.email!==String(lead.fields['Contact Email']).toLowerCase())throw Error('WEB_CONTACT_MISMATCH');
      const key=`boltech:web-request:dispatch:${e.requestId}`;
      const raw=await command(['GET',key]);let job=raw?JSON.parse(raw):null;
      await gmail.verify();
      if(job&&['SEND_PENDING','UNKNOWN'].includes(job.state)){
        const found=await gmail.search(`in:sent rfc822msgid:${job.rfcMessageId}`);
        if(found.length!==1){results.push({state:job.state,retryAllowed:false});continue;}
        const sent=await gmail.message(found[0].id);
        if(!sent.sent||sent.from!==SDR_SENDER||!sent.to.toLowerCase().includes(e.email)||sent.rfcMessageId.replace(/[<>]/g,'')!==job.rfcMessageId)throw Error('WEB_SEND_RECONCILIATION_REQUIRED');
        job={...job,state:'SENT',messageId:sent.id,threadId:sent.threadId,sentAt:sent.receivedAt};await command(['SET',key,JSON.stringify(job)]);
      }
      if(job?.state==='SENT'||job?.state==='CUSTOMER_REPLY'){
        const messages=await gmail.thread(job.threadId);
        const replies=messages.filter(m=>!m.sent&&!m.automatic&&m.from===e.email&&m.to.toLowerCase().includes(SDR_SENDER)&&m.text?.trim()&&m.rfcMessageId&&Date.parse(m.receivedAt)>=Date.parse(job.sentAt)).sort((a,b)=>Date.parse(b.receivedAt)-Date.parse(a.receivedAt));
        const reply=replies[0];
        if(reply){const stop=/^(stop|no|unsubscribe)[.!\s]*$|no me interesa|no deseo/i.test(reply.text.split(/\n(?:>|On .*wrote:|El .*escribi[oó]:)/)[0].trim());job={...job,state:stop?'SUPPRESSED':'CUSTOMER_REPLY',evidenceRef:reply.id};await command(['SET',key,JSON.stringify(job)]);}
        await persist(row,job);results.push({state:job.state,...(job.state==='CUSTOMER_REPLY'?{opportunityId:lead.id,evidenceRef:job.evidenceRef}:{})});continue;
      }
      if(job){results.push({state:job.state,retryAllowed:false});continue;}
      if(!sdrWindow(now()).allowed){results.push({state:'OUTSIDE_SEND_WINDOW'});continue;}
      const history=await gmail.search(`in:anywhere "${e.email}"`);
      if(history.length){results.push({state:'EXISTING_CONVERSATION_REVIEW_REQUIRED',workId:row.id});continue;}
      if((await gmail.search('in:sent newer_than:1d')).length>=100){results.push({state:'MAILBOX_CAPACITY_HOLD'});continue;}
      job={...webRequestMessage(e,e.language),email:e.email,state:'SEND_PENDING',rfcMessageId:`boltech-web-${e.requestId}@boltech-group.vercel.app`,requestedAt:e.receivedAt};
      if(await command(['SET',key,JSON.stringify(job),'NX'])!=='OK'){results.push({state:'CONCURRENT_CYCLE_HOLD'});continue;}
      await persist(row,job);
      if(await command(['GET',lock])!==lease)throw Error('WEB_MAILBOX_LEASE_LOST');
      try{const sent=await gmail.send(job);job={...job,...sent,state:'SENT',sentAt:now().toISOString()};await command(['SET',key,JSON.stringify(job)]);await persist(row,job);results.push({state:'SENT',messageId:sent.messageId,threadId:sent.threadId});}
      catch{const current=JSON.parse(await command(['GET',key])||'{}');if(current.state!=='SENT')await command(['SET',key,JSON.stringify({...job,state:'UNKNOWN'})]);results.push({state:current.state==='SENT'?'SENT_CRM_REVIEW':'UNKNOWN',retryAllowed:false});}
    }catch(error){results.push({state:'BLOCKED',code:error.code||error.message,workId:row.id});}}
    return {results};
    }finally{await command(['EVAL',release,1,lock,lease]);}
  }
  return {run};
}

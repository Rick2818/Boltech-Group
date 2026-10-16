import crypto from 'node:crypto';
import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
import {redisCommand} from './rsi_handoff_store.js';
import {createRsi03Closing} from './rsi03_closing.js';

const LEADS='tblZaox2MX5uYA5PZ', WORK='tblHVqUMifOFjlGvj';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const email=v=>String(v||'').toLowerCase().trim().replace(/^.*<([^>]+)>.*$/,'$1');
const excluded=f=>f?.Unsubscribed||f?.['Do Not Contact']||f?.['Data Quality']==='QA'||/unsubscribed|suppressed|do not contact|bounced|disqualified/i.test([f?.Status,f?.['Commercial Stage'],f?.Notes].join(' '));
const refusal=/\b(unsubscribe|stop emailing|remove me|do not contact|don't contact|no thanks|not interested|opt out|baja de lista|no me escriban)\b/i;
const buyerSignal=/\b(quote|pricing|price|demo|meeting|interested|help|problem|workflow|proposal|call|cost|budget|pilot|cotizaci[oó]n|precio|reuni[oó]n|interesad|propuesta)\b/i;
const authHeader=token=>({Authorization:'Bearer '+token,'Content-Type':'application/json'});
export function classifyRsi02Reply(message) {
 if(message?.automatic||message?.sent)return 'AUTOMATIC_HOLD';
 if(!String(message?.text||'').trim())return 'EMPTY_HOLD';
 if(refusal.test(message.text))return 'OPT_OUT';
 return buyerSignal.test(message.text)?'INTERESTED':'ACKNOWLEDGE';
}
export function createRsi02InboxExecutor({gmail=createSdrGmail(),command=redisCommand,fetcher=fetch,env=process.env,now=()=>new Date(),closing=createRsi03Closing()}={}) {
 const base=env.AIRTABLE_BASE_ID||'appCQZd0IhBHFoZ9P';
 async function table(name,{id,fields,offset}={}) {
  if(!env.AIRTABLE_TOKEN)fail('RSI02_AIRTABLE_MISSING');
  const url='https://api.airtable.com/v0/'+encodeURIComponent(base)+'/'+name+(id?'/'+encodeURIComponent(id):'?pageSize=100'+(offset?'&offset='+encodeURIComponent(offset):''));
  const response=await fetcher(url,{method:fields?'PATCH':'GET',headers:authHeader(env.AIRTABLE_TOKEN),...(fields?{body:JSON.stringify({fields})}:{ }),signal:AbortSignal.timeout(11000)});
  if(!response.ok)fail('RSI02_AIRTABLE_UNAVAILABLE');
  return response.json();
 }
 async function allRows(name){
  const records=[];let offset,steps=0;
  do{const data=await table(name,{offset});records.push(...(data.records||[]));offset=data.offset;if(++steps>20)fail('RSI02_CRM_PAGINATION_LIMIT');}while(offset);
  return records;
 }
 async function crmUpdate(lead,marker,fields={}) {
  const note=String(lead.fields.Notes||'');
  const updated=await table(LEADS,{id:lead.id,fields:{...fields,Notes:note.includes(marker)?note:note+'\n'+marker}});
  if(updated.id!==lead.id)fail('RSI02_CRM_WRITE_UNCONFIRMED');
 }
 async function inspect() {
  await gmail.verify();
  const rows=await allRows(LEADS);
  const candidates=await gmail.search('in:inbox newer_than:7d');
  const result={observed:candidates.length,processed:0,replied:0,held:0,optOut:0,qualified:0,skipped:0,items:[]};
  for(const item of candidates.slice(0,75)){
   const m=await gmail.message(item.id);
   if(!m||m.sent||m.from===SDR_SENDER||!m.threadId||!m.id){result.skipped++;continue;}
   const row=rows.find(r=>email(r.fields?.['Contact Email'])===email(m.from));
   if(!row||excluded(row.fields)||!/^rec[A-Za-z0-9]{14}$/.test(row.id)){result.skipped++;continue;}
   const history=await gmail.thread(m.threadId);
   const outgoing=history.some(x=>x.sent&&email(x.from)===SDR_SENDER&&Date.parse(x.receivedAt)<Date.parse(m.receivedAt));
   if(!outgoing){result.skipped++;continue;}
   const marker='[RSI02_REPLY:'+m.id+']',key='boltech:rsi02:inbox:'+m.id;
   if(await command(['GET',key])){result.skipped++;continue;}
   const kind=classifyRsi02Reply(m);
   // Disabled mode must not claim legitimate replies; they remain eligible after activation.
   if(env.RSI02_AUTOREPLY_ENABLED!=='true' && kind!=='OPT_OUT'){
    result.held++;result.items.push({messageId:m.id,state:'DISABLED_UNCLAIMED'});continue;
   }
   // A permanent NX claim precedes any send. Unknown outcomes NEVER auto-retry.
   if(await command(['SET',key,JSON.stringify({state:'CLAIMED',kind,at:now().toISOString()}),'NX'])!=='OK'){result.skipped++;continue;}
   result.processed++;
   try {
    if(kind==='OPT_OUT'){
     await crmUpdate(row,marker,{'Do Not Contact':true,'Commercial Stage':'Replied'});
     await command(['SET',key,JSON.stringify({state:'OPT_OUT',kind,leadId:row.id})]);
     result.optOut++;result.items.push({messageId:m.id,state:'OPT_OUT'});continue;
    }
    if(kind==='AUTOMATIC_HOLD'||kind==='EMPTY_HOLD'){
     await crmUpdate(row,marker,{'Commercial Stage':'Replied'});
     await command(['SET',key,JSON.stringify({state:'HOLD',kind,leadId:row.id})]);
     result.held++;result.items.push({messageId:m.id,state:'HOLD'});continue;
    }
    const body=kind==='INTERESTED'
      ?'Thank you for getting back to Boltech Group. To understand the right next step, could you briefly describe the workflow that is taking the most time and what outcome you would like to improve? We can then arrange a short discussion. We will not commit to scope or pricing without reviewing the requirements.\n\nBest,\nRicardo\nBoltech Group'
      :'Thank you for your reply to Boltech Group. I appreciate your time. Could you let us know whether there is an operational process you would like to discuss, or whether you prefer no further contact?\n\nBest,\nRicardo\nBoltech Group';
    // Explicit operational switch; default off until live synthetic QA passes.
    if(env.RSI02_AUTOREPLY_ENABLED!=='true'){
      await command(['SET',key,JSON.stringify({state:'DRY_RUN_HOLD',kind,leadId:row.id})]);
      result.held++;result.items.push({messageId:m.id,state:'DRY_RUN_HOLD'});continue;
    }
    const sent=await gmail.send({email:m.from,subject:/^re:/i.test(m.subject)?m.subject:'Re: '+m.subject,text:body,threadId:m.threadId,inReplyTo:m.rfcMessageId,rfcMessageId:'boltech-rsi02-'+crypto.createHash('sha256').update(m.id).digest('hex')+'@boltech-group.vercel.app'});
    if(!sent.messageId||sent.threadId!==m.threadId)fail('RSI02_PROVIDER_RECEIPT_UNCONFIRMED');
    await command(['SET',key,JSON.stringify({state:'SENT',kind,leadId:row.id,replyTo:m.id,sentId:sent.messageId,threadId:sent.threadId})]);
    result.replied++;
    try {await crmUpdate(row,marker+' '+JSON.stringify({sentId:sent.messageId,kind,threadId:sent.threadId}),{'Commercial Stage':'Replied'});}catch{result.items.push({messageId:m.id,state:'SENT_CRM_PENDING',sentId:sent.messageId});continue;}
    if(kind==='INTERESTED')result.qualified++;
    result.items.push({messageId:m.id,state:'SENT',sentId:sent.messageId,kind});
   }catch(error){
    // Error after claim is uncertain: no repetition of emails.
    await command(['SET',key,JSON.stringify({state:'UNKNOWN_REVIEW',kind,code:error.code||'RSI02_UNCERTAIN',leadId:row.id})]);
    result.items.push({messageId:m.id,state:'UNKNOWN_REVIEW'});
   }
  }
  return result;
 }
 async function run() {
  const inbox=await inspect();
  let rsi03;
  try {
   const work=await allRows(WORK);
   rsi03=await closing.runNext(work);
  }catch(e){rsi03={state:'BLOCKED',code:e.code||'RSI03_RUNTIME_UNAVAILABLE'};}
  return {success:true,autonomousReplyEnabled:env.RSI02_AUTOREPLY_ENABLED==='true',inbox,rsi03};
 }
 return {inspect,run};
}

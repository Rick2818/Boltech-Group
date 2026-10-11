#!/usr/bin/env node
/** RSI-01 authenticated Gmail dispatcher. Strictly opt-in; fail closed.
 * The Airtable ledger is required and written BEFORE attempting Gmail.
 * Unknown outcomes remain PENDING_RECONCILIATION: never auto-retry.
 */
const fs=require('node:fs');
const API='https://api.airtable.com/v0';
const REQUIRED=['buyer_verified','contact_verified','intent_verified','permission_verified','template_approved','recipient_verified'];
function safeEmail(s){return typeof s==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);}
function validate(intent,approval,allowedSender){
 if(intent.status!=='APPROVED_PENDING_DISPATCH'||intent.send_performed!==false)throw Error('INTENT_NOT_APPROVED');
 if(!approval||REQUIRED.some(k=>approval[k]!==true)||approval.release_to_send!==true)throw Error('RELEASE_NOT_AUTHORIZED');
 if(!safeEmail(intent.recipient)||!safeEmail(intent.sender)||intent.sender!==allowedSender||!safeEmail(approval.recipient)||approval.recipient!==intent.recipient)throw Error('SENDER_OR_RECIPIENT_MISMATCH');
 if(!intent.subject||!intent.body||intent.subject!==approval.approved_subject||intent.body!==approval.approved_body)throw Error('CONTENT_MISMATCH');
 if(!/^[a-f0-9]{64}$/.test(intent.event_id))throw Error('EVENT_ID_INVALID');
}
async function resolveGmailToken(config,fetchImpl){
 if(config.gmailRefreshToken&&config.gmailClientId&&config.gmailClientSecret){
  const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.gmailClientId,client_secret:config.gmailClientSecret,refresh_token:config.gmailRefreshToken,grant_type:'refresh_token'}).toString()});
  if(!response.ok)throw Error('GMAIL_OAUTH_REFRESH_FAILED_'+response.status);
  const token=await response.json();
  if(!token.access_token)throw Error('GMAIL_OAUTH_REFRESH_EMPTY');
  return token.access_token;
 }
 if(config.gmailAccessToken)return config.gmailAccessToken;
 throw Error('GMAIL_AUTH_NOT_CONFIGURED');
}
function b64url(s){return Buffer.from(s,'utf8').toString('base64url');}
async function dispatch(queue,approvals,config,{fetchImpl=fetch}={}){
 if(config.enabled!=='true')return {state:'DISABLED',sent:0};
 for(const k of ['airtableToken','airtableBase','sender'])if(!config[k])throw Error('MISSING_'+k);
 if(queue?.executor!=='RSI-01'||queue?.mode!=='PREPARE_ONLY'||!Array.isArray(queue.results))throw Error('INVALID_QUEUE');
 const results=[];
 let gmailToken;
 for(const intent of queue.results){
  if(intent.status!=='APPROVED_PENDING_DISPATCH'){results.push({event_id:intent.event_id,state:'BLOCKED'});continue;}
  const approval=approvals[intent.event_id];validate(intent,approval,config.sender);
  const key='RSI01:GMAIL:'+intent.event_id;
  const url=API+'/'+encodeURIComponent(config.airtableBase)+'/'+encodeURIComponent('RSI Agent Work');
  const headers={Authorization:'Bearer '+config.airtableToken,'Content-Type':'application/json'};
  const check=await fetchImpl(url+'?'+new URLSearchParams({filterByFormula:'{Work ID}="'+key+'"',maxRecords:'2'}),{headers});
  if(!check.ok)throw Error('LEDGER_READ_FAILED_'+check.status);
  const found=await check.json();
  if(!Array.isArray(found.records))throw Error('LEDGER_INVALID');
  if(found.records.length){results.push({event_id:intent.event_id,state:'ALREADY_RESERVED_RECONCILE',record_id:found.records[0].id});continue;}
  // Reserve BEFORE send. An ambiguous POST is never retried.
  const reserve=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify({records:[{fields:{'Work ID':key,RSI:'RSI-01',Owner:'RSI-01',Status:'DISPATCH_RESERVED','Execution State':'PENDING_RECONCILIATION',Authorization:'Approved release; see private audit',Evidence:JSON.stringify({event_id:intent.event_id,recipient:intent.recipient,source:intent.source}), 'Next Action':'Reconcile Gmail sent folder before any retry.'}}]})});
  if(!reserve.ok)throw Error('LEDGER_RESERVATION_UNCERTAIN_'+reserve.status);
  const reserved=await reserve.json();const record=reserved.records?.[0]?.id;
  if(!record)throw Error('LEDGER_RESERVATION_UNCERTAIN');
  if(!gmailToken)gmailToken=await resolveGmailToken(config,fetchImpl);
  const mime='From: '+intent.sender+'\r\nTo: '+intent.recipient+'\r\nSubject: '+intent.subject.replace(/[\r\n]/g,' ')+'\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n'+intent.body;
  const send=await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+gmailToken,'Content-Type':'application/json'},body:JSON.stringify({raw:b64url(mime)})});
  if(!send.ok)throw Error('GMAIL_SEND_UNCERTAIN_'+send.status);
  const sent=await send.json();
  if(!sent.id)throw Error('GMAIL_SEND_UNCERTAIN');
  const update=await fetchImpl(url+'/'+record,{method:'PATCH',headers,body:JSON.stringify({fields:{Status:'GMAIL_SENT','Execution State':'COMPLETED','Execution Receipt':JSON.stringify({gmail_message_id:sent.id,event_id:intent.event_id,sent:true}), 'Next Action':'Track response and follow up according to approved cadence.'}})});
  if(!update.ok)throw Error('RECEIPT_WRITE_UNCERTAIN_'+update.status);
  results.push({event_id:intent.event_id,state:'SENT',gmail_message_id:sent.id,record_id:record});
 }
 return {state:'EXECUTED',sent:results.filter(r=>r.state==='SENT').length,results};
}
if(require.main===module){
 try{
  const queue=JSON.parse(fs.readFileSync(process.env.RSI_OUTREACH_OUTPUT||'artifacts/blia01/rsi01-outreach-queue.json','utf8'));
  const approvals=process.env.RSI_APPROVALS_FILE?JSON.parse(fs.readFileSync(process.env.RSI_APPROVALS_FILE,'utf8')):{};
  dispatch(queue,approvals,{enabled:process.env.RSI_GMAIL_SEND_ENABLED,airtableToken:process.env.AIRTABLE_TOKEN,airtableBase:process.env.AIRTABLE_BASE_ID,gmailAccessToken:process.env.GMAIL_ACCESS_TOKEN,gmailRefreshToken:process.env.GMAIL_REFRESH_TOKEN,gmailClientId:process.env.GMAIL_CLIENT_ID,gmailClientSecret:process.env.GMAIL_CLIENT_SECRET,sender:process.env.RSI_GMAIL_SENDER}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error('RSI_GMAIL_DISPATCH_FAILED',e.message);process.exitCode=1;});
 }catch(e){console.error('RSI_GMAIL_DISPATCH_FAILED',e.message);process.exitCode=1;}
}
module.exports={dispatch,validate,resolveGmailToken};

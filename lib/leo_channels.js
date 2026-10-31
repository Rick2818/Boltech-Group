import {createHash} from 'node:crypto';
import {requireOperationalAuth} from './operational_auth.js';
import {createSdrGmail,SDR_SENDER,gmailReadiness} from './sdr_gmail.js';
import {getWhatsAppStatus} from './whatsapp_engine.js';
const fail=(res,status,code)=>res.status(status).json({success:false,code});
export async function handleLeoChannels(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!requireOperationalAuth(req,res))return;
 if(req.method==='GET'){
  const gmail=gmailReadiness(),wa=getWhatsAppStatus();
  return res.status(200).json({success:true,gmail:{configured:gmail.configured,sender:SDR_SENDER},whatsapp:{configured:wa.configured,provider:'Twilio',verified:false},sendingEnabled:false});
 }
 if(req.method!=='POST')return fail(res,405,'METHOD_NOT_ALLOWED');
 if(Number(req.headers['content-length']||0)>12000)return fail(res,413,'PAYLOAD_TOO_LARGE');
 const b=req.body||{};
 if(b.action!=='send_approved_quote')return fail(res,400,'ACTION_NOT_ALLOWED');
 if(b.ownerApproved!==true||b.recipientConsent!==true)return fail(res,403,'QUOTE_APPROVAL_AND_CONSENT_REQUIRED');
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 const subject=typeof b.subject==='string'?b.subject.trim():'';
 const body=typeof b.body==='string'?b.body.trim():'';
 const reference=typeof b.reference==='string'?b.reference.trim():'';
 if(!/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(email)||email.length>254||!subject||subject.length>180||!body||body.length>9000||!/^[A-Za-z0-9_-]{12,96}$/.test(reference)||/[\r\n\x00]/.test(subject))return fail(res,400,'INVALID_QUOTE');
 const gmail=createSdrGmail();
 const key=createHash('sha256').update(['leo-quote-v1',reference,email,subject,body].join('\n')).digest('hex');
 const messageId='<'+key.slice(0,32)+'@boltech-group.vercel.app>';
 try{
  // Preflight against repeats. The caller must serialize concurrent approvals.
  const existing=await gmail.search('in:sent rfc822msgid:'+messageId);
  if(existing.length)return res.status(409).json({success:false,code:'QUOTE_ALREADY_SENT_OR_REVIEW_REQUIRED'});
  const result=await gmail.send({email,subject,text:body,rfcMessageId:messageId});
  return res.status(200).json({success:true,status:'ACCEPTED_BY_GMAIL',sender:SDR_SENDER,messageId:result.messageId,threadId:result.threadId});
 }catch(e){console.error('[leo quote]',String(e.code||'SEND_UNAVAILABLE'));return fail(res,503,e.code==='GMAIL_SEND_UNKNOWN'?'SEND_OUTCOME_UNKNOWN':'GMAIL_SEND_UNAVAILABLE');}
}

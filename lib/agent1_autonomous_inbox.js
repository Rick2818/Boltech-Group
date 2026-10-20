import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
import {classifySalesReply} from './agent1_v2_sales_cycle.js';
const email=v=>String(v||'').trim().toLowerCase();
export async function runInboundSalesCycle({gmail=createSdrGmail(),env=process.env,fetcher=fetch}={}){
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw Error('SALES_INBOX_CRM_UNAVAILABLE');
 if([...SUPABASE_SERVICE_ROLE_KEY].some(x=>x.codePointAt(0)>255))throw Error('SALES_INBOX_CRM_KEY_INVALID');
 await gmail.verify();
 const root=SUPABASE_URL.replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY};
 async function db(path,options={}){const r=await fetcher(root+path,{...options,headers:{...headers,...options.headers}});if(!r.ok)throw Error('SALES_INBOX_CRM_HTTP_'+r.status);const t=await r.text();return t?JSON.parse(t):null;}
 const leads=await db('/leads?select=id,contact_email,status,data_quality,source_evidence_url&limit=1000');
 if(!Array.isArray(leads))throw Error('SALES_INBOX_LEADS_INVALID');
 const contacts=new Map(leads.filter(l=>l.contact_email&&!/qa|synthetic/i.test(String(l.data_quality||''))).map(l=>[email(l.contact_email),l]));
 const hits=await gmail.search('in:inbox newer_than:14d -from:'+SDR_SENDER);
 const stats={searched:hits.length,matched:0,replied:0,held:0,duplicate:0};
 for(const hit of hits.slice(0,100)){
  const message=await gmail.message(hit.id);
  if(message.sent||message.automatic||!message.id||!message.threadId)continue;
  const lead=contacts.get(email(message.from));if(!lead)continue;
  stats.matched++;
  const result=classifySalesReply({text:message.text});
  let reply=null;
  if(result.action==='PREPARE_SCOPE_QUESTIONS')reply='Thanks for your interest in Boltech Group. Our defined pilot implementation starts at USD 990, with 50% upfront after the agreed scope and 50% upon verified delivery. What specific workflow would you like automated, which systems do you currently use, and what volume do you handle? We will confirm scope and feasibility before preparing a proposal.';
  if(result.action==='OFFER_DISCOVERY')reply='Thanks for your interest in Boltech Group. Which manual workflow causes the most delays for your team, and which tools does it involve? We can review a clearly defined pilot and its acceptance criteria by email.';
  // Reserve unique provider message before side effects. UNKNOWN must not be automatically retried.
  const record={message_id:message.id,lead_id:lead.id,thread_id:message.threadId,stage:result.stage,action:result.action,status:'RESERVED'};
  const reserve=await fetcher(root+'/agent1_inbound_sales_jobs?on_conflict=message_id',{method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify([record])});
  if(!reserve.ok)throw Error('SALES_INBOX_RESERVATION_HTTP_'+reserve.status);
  const inserted=await reserve.json();
  if(!Array.isArray(inserted)||inserted.length!==1){stats.duplicate++;continue;}
  let status='REVIEW_REQUIRED',replyId=null;
  try{
   if(reply&&lead.status==='CONTACTED'){
    const sent=await gmail.send({email:email(message.from),subject:'Re: '+String(message.subject||'Your inquiry').replace(/^re:\\s*/i,''),text:reply,threadId:message.threadId,inReplyTo:message.rfcMessageId});
    if(!sent.messageId)throw Error('SALES_INBOX_SEND_RECEIPT_MISSING');
    replyId=sent.messageId;status='REPLIED';stats.replied++;
   }else{status=result.action==='SUPPRESS'?'SUPPRESS_REVIEW':'REVIEW_REQUIRED';stats.held++;}
  }catch{status='UNKNOWN_SEND_STATE';stats.held++;}
  await db('/agent1_inbound_sales_jobs?message_id=eq.'+encodeURIComponent(message.id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status,reply_message_id:replyId,updated_at:new Date().toISOString()})});
 }
 return {...stats,proof:'GMAIL_MESSAGE_AND_SUPABASE_JOB',paymentRecorded:false};
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await runInboundSalesCycle())}catch(e){return res.status(503).json({error:String(e.message).slice(0,120)})}
}

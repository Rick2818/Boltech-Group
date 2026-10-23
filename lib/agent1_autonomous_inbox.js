import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
import {classifySalesReply} from './agent1_v2_sales_cycle.js';
import {commercialSchedulerAuthorized} from './commercial_scheduler_auth.js';
import {reconcileCanonicalFollowups,currentReplyText,containsAddress,latestFirst} from './canonical_followups.js';
import {runCanonicalOutreach} from './canonical_outreach.js';
const email=v=>String(v||'').trim().toLowerCase();
export async function runInboundSalesCycle({gmail=createSdrGmail(),env=process.env,fetcher=fetch,outreach=runCanonicalOutreach,now=new Date()}={}){
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw Error('SALES_INBOX_CRM_UNAVAILABLE');
 if([...SUPABASE_SERVICE_ROLE_KEY].some(x=>x.codePointAt(0)>255))throw Error('SALES_INBOX_CRM_KEY_INVALID');
 const root=SUPABASE_URL.replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY};
 async function db(path,options={}){const r=await fetcher(root+path,{...options,headers:{...headers,...options.headers}});if(!r.ok)throw Error('SALES_INBOX_CRM_HTTP_'+r.status);const t=await r.text();return t?JSON.parse(t):null;}
 const quotaPath='/agent_work?work_id=eq.agent1-gmail-quota&select=execution_receipt';
 const [quotaState]=await db(quotaPath);
 const previous=quotaState?.execution_receipt||{};
 if(Date.parse(previous.retryAt)>now.getTime())return {status:'GMAIL_QUOTA_BACKOFF',retryAt:previous.retryAt,proof:'DEFERRED_NO_GMAIL_CALLS'};
 const saveQuota=receipt=>db('/agent_work?on_conflict=work_id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{work_id:'agent1-gmail-quota',owner_agent:'AGENT1',status:receipt.retryAt?'WAITING':'ACTIVE',execution_state:receipt.retryAt?'GMAIL_QUOTA_BACKOFF':'GMAIL_QUOTA_RECOVERED',execution_receipt:receipt,updated_at:now.toISOString()}])});
 try{
 await gmail.verify();
 const leads=[];
 for(let offset=0;;offset+=1000){const page=await db('/leads?select=id,name,company_url,country,contact_email,status,commercial_stage,data_quality,source_evidence_url,source_payload&order=id.asc&limit=1000&offset='+offset);if(!Array.isArray(page))throw Error('SALES_INBOX_LEADS_INVALID');leads.push(...page);if(page.length<1000)break;}
 if(!Array.isArray(leads))throw Error('SALES_INBOX_LEADS_INVALID');
 const contacts=new Map(leads.filter(l=>l.contact_email&&!/qa|synthetic/i.test(String(l.data_quality||''))).map(l=>[email(l.contact_email),l]));
 // Search only canonical contacts; unrelated inbox traffic must not exhaust
 // Gmail quota before sales replies and scheduled followups can be processed.
 const addresses=[...contacts.keys()].filter(x=>/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(x));
 const hitMap=new Map();
 for(let offset=0;offset<addresses.length;offset+=40){
  const query='in:inbox newer_than:14d -from:'+SDR_SENDER+' {'+addresses.slice(offset,offset+40).map(x=>'from:'+x).join(' ')+'}';
  for(const hit of await gmail.search(query))hitMap.set(hit.id,hit);
 }
 const hits=[...hitMap.values()];
 const followups=await reconcileCanonicalFollowups({leads,gmail,db,now});
 const stats={searched:hits.length,matched:0,replied:0,held:0,duplicate:0,followups};
 for(const hit of hits.slice(0,100)){
  const message=await gmail.message(hit.id);
  if(message.sent||message.automatic||!message.id||!message.threadId)continue;
  const lead=contacts.get(email(message.from));if(!lead)continue;
  stats.matched++;
  const history=await gmail.thread(message.threadId);
  const latest=latestFirst(history.filter(m=>!m.sent&&!m.automatic&&email(m.from)===email(message.from)))[0];
  if(latest?.id!==message.id||!history.some(m=>m.sent&&email(m.from)===SDR_SENDER&&containsAddress(m.to,message.from))){stats.held++;continue;}
  const result=classifySalesReply({text:currentReplyText(message.text)});
  if(['SUPPRESS','STOP_SEQUENCE'].includes(result.action)){
   await db('/leads?id=eq.'+lead.id,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:'SUPPRESSED',commercial_stage:'SUPPRESSED',next_action:'Do not contact: customer declined or opted out.',updated_at:new Date().toISOString()})});
   lead.status='SUPPRESSED';
  }
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
   if(reply&&lead.status==='CONTACTED'&&!['SUPPRESSED','LOST','WON'].includes(String(lead.commercial_stage||'').toUpperCase())&&message.rfcMessageId){
    const sent=await gmail.send({email:email(message.from),subject:'Re: '+String(message.subject||'Your inquiry').replace(/^re:\s*/i,''),text:reply,threadId:message.threadId,inReplyTo:message.rfcMessageId,rfcMessageId:'boltech-reply-'+message.id+'@boltech-group.vercel.app'});
    if(!sent.messageId)throw Error('SALES_INBOX_SEND_RECEIPT_MISSING');
    replyId=sent.messageId;status='REPLIED';stats.replied++;
   }else{status=result.action==='SUPPRESS'?'SUPPRESS_REVIEW':'REVIEW_REQUIRED';stats.held++;}
  }catch{status='UNKNOWN_SEND_STATE';stats.held++;}
  await db('/agent1_inbound_sales_jobs?message_id=eq.'+encodeURIComponent(message.id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status,reply_message_id:replyId,updated_at:new Date().toISOString()})});
 }
 if(followups.errors.length)throw Error('FOLLOWUP_RECONCILIATION_INCOMPLETE');
 const campaign=await outreach({leads,db,gmail,now});
 if(campaign.errors?.length)throw Error('CANONICAL_CAMPAIGN_ATTENTION_REQUIRED');
 if(previous.failures)await saveQuota({failures:0,recoveredAt:now.toISOString()});
 return {...stats,campaign,proof:'GMAIL_MESSAGE_AND_SUPABASE_JOB',paymentRecorded:false};
 }catch(e){
  if(e.code==='GMAIL_RATE_LIMITED'||e.diagnostic&&['rateLimitExceeded','userRateLimitExceeded','quotaExceeded','dailyLimitExceeded'].includes(e.diagnostic.reason)){
   const failures=Math.min((Number(previous.failures)||0)+1,8);
   const delay=e.diagnostic?.reason==='dailyLimitExceeded'?3600000:Math.min(3600000,60000*2**(failures-1));
   await saveQuota({failures,retryAt:new Date(now.getTime()+delay).toISOString(),diagnostic:e.diagnostic||{reason:'rateLimitExceeded'},checkedAt:now.toISOString()});
  }
  throw e;
 }
}
export default async function handler(req,res){
 const scheduled=req.method==='GET'&&(req.query?.scheduled_campaign==='1'||new URL(req.url||'/','https://boltech-group.vercel.app').searchParams.get('scheduled_campaign')==='1');
 if(req.method!=='POST'&&!scheduled)return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!commercialSchedulerAuthorized(req))return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await runInboundSalesCycle())}catch(e){return res.status(503).json({error:String(e.message).slice(0,120),...(e.diagnostic?{diagnostic:e.diagnostic}:{})})}
}

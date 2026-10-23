import {createHash,randomUUID} from 'node:crypto';
import {verifyPublishedCandidate,prepareCampaignDraft} from './agent1_continuous_research.js';
import {SDR_SENDER} from './sdr_gmail.js';
import {redisCommand} from './rsi_handoff_store.js';
import {isBlacklisted} from './compliance_dnc.js';
import {followupDueAt} from './canonical_followup_sender.js';

const account=url=>new URL(url).hostname.toLowerCase().replace(/^www\./,'');
const hasAddress=(value,address)=>String(value||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)?.includes(address.toLowerCase())===true;
const sendWindow=now=>{const local=new Date(now.getTime()-6*3600000);return ![0,6].includes(local.getUTCDay())&&local.getUTCHours()>=9&&local.getUTCHours()<17;};
// The existing inbox executor drains this canonical queue. Runtime budget bounds
// one invocation, never a target number of researched or prepared prospects.
export async function runCanonicalOutreach({leads,db,gmail,now=new Date(),clock=Date.now,budgetMs=40000,verifyCandidate=verifyPublishedCandidate,command=redisCommand,suppressionCheck=isBlacklisted}){
 const stats={reviewed:0,verified:0,sent:0,reconciled:0,held:0,errors:[],providerReceipts:[]};
 if(!sendWindow(now))return {...stats,status:'OUTSIDE_INITIAL_SEND_WINDOW'};
 const start=clock(),headers={'Content-Type':'application/json',Prefer:'return=representation'};
 const candidates=leads.filter(l=>l.status==='NEW'&&l.commercial_stage==='PREPARED'&&l.contact_email&&l.source_payload?.campaignDraft&&!/QA|SYNTHETIC/i.test(l.data_quality||''));
 for(const lead of candidates){
  if(clock()-start>=budgetMs)break;
  stats.reviewed++;let path,runId,receipt,owned=false;
  try{
   const domain=account(lead.company_url),email=lead.contact_email.trim().toLowerCase();
   if(lead.country!=='US')throw Error('OUTREACH_MARKET_REVIEW_REQUIRED');
   if(leads.some(l=>l.id!==lead.id&&l.status==='CONTACTED'&&(l.contact_email?.toLowerCase()===email||l.company_url&&account(l.company_url)===domain))){stats.held++;continue;}
   const workId='initial:'+domain;path='/agent_work?work_id=eq.'+encodeURIComponent(workId);
   await db('/agent_work?on_conflict=work_id',{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([{work_id:workId,lead_id:lead.id,owner_agent:'AGENT1',status:'PENDING',execution_state:'INITIAL_OUTREACH_REVIEW',execution_receipt:{leadId:lead.id,email},next_action:'Revalidate official evidence and all contact histories before initial outreach.'}])});
   const [work]=await db(path+'&select=execution_run_id,execution_receipt');
   if(!work)throw Error('OUTREACH_WORK_MISSING');
   receipt={...(work.execution_receipt||{})};
   if(receipt.leadId!==lead.id||receipt.email!==email||Date.parse(receipt.leaseUntil)>now.getTime()){stats.held++;continue;}
   runId=randomUUID();receipt.leaseUntil=new Date(now.getTime()+180000).toISOString();
   const claim=await db(path+'&execution_run_id='+(work.execution_run_id?'eq.'+encodeURIComponent(work.execution_run_id):'is.null'),{method:'PATCH',headers,body:JSON.stringify({execution_run_id:runId,execution_receipt:receipt})});
   if(claim?.length!==1){stats.held++;continue;}owned=true;
   const save=async state=>{
    const rows=await db(path+'&execution_run_id=eq.'+runId,{method:'PATCH',headers,body:JSON.stringify({execution_state:state,status:state==='SENT'?'COMPLETED':'PENDING',execution_receipt:receipt,updated_at:now.toISOString()})});
    if(rows?.length!==1)throw Error('OUTREACH_LEASE_LOST');
    const [saved]=await db(path+'&select=execution_receipt,execution_run_id');
    if(saved?.execution_run_id!==runId||saved.execution_receipt?.sendState!==receipt.sendState)throw Error('OUTREACH_READBACK_MISSING');
   };
   const markContacted=async sent=>{
    const message=await gmail.message(sent.messageId);
    if(!message.sent||message.from!==SDR_SENDER||!hasAddress(message.to,email)||message.threadId!==sent.threadId)throw Error('OUTREACH_PROVIDER_RECEIPT_UNVERIFIED');
    const [current]=await db('/leads?id=eq.'+lead.id+'&select=id,status,source_payload');
    if(!current)throw Error('OUTREACH_CRM_CONTACT_MISSING');
    if(!['NEW','CONTACTED'].includes(current.status))throw Error('OUTREACH_CRM_STATE_CHANGED');
    const payload={...current.source_payload,gmail_sent_message_id:sent.messageId,gmail_thread_id:sent.threadId,campaign:new Date(Date.parse(message.receivedAt)-6*3600000).toISOString().slice(0,10),owner_agent:'AGENT1'};
    const rows=await db('/leads?id=eq.'+lead.id+'&status=eq.'+current.status,{method:'PATCH',headers,body:JSON.stringify({status:'CONTACTED',commercial_stage:'outreach_sent',source_payload:payload,next_action:'First follow-up due '+followupDueAt(message.receivedAt)+' unless the customer responds or opts out.',updated_at:now.toISOString()})});
    if(rows?.length!==1||rows[0].source_payload?.gmail_sent_message_id!==sent.messageId)throw Error('OUTREACH_CRM_RECEIPT_UNCONFIRMED');
    Object.assign(lead,rows[0]);stats.providerReceipts.push({leadId:lead.id,messageId:sent.messageId,threadId:sent.threadId});
   };
   receipt.rfcMessageId='boltech-initial-'+createHash('sha256').update(domain).digest('hex')+'@boltech-group.vercel.app';
   if(['SEND_PENDING','UNKNOWN','SENT'].includes(receipt.sendState)){
    let sent=receipt.messageId?{messageId:receipt.messageId,threadId:receipt.threadId}:null;
    if(!sent){const hits=await gmail.search('in:sent rfc822msgid:'+receipt.rfcMessageId);if(hits.length===1){const m=await gmail.message(hits[0].id);if(String(m.rfcMessageId||'').replace(/[<>]/g,'')===receipt.rfcMessageId)sent={messageId:m.id,threadId:m.threadId};}}
    if(!sent){stats.held++;continue;}
    await markContacted(sent);Object.assign(receipt,sent,{sendState:'SENT'});await save('SENT');stats.reconciled++;continue;
   }
   const assigned=lead.source_payload?.campaignDraft;
   const checked=await verifyCandidate(lead,{now});
   const v=checked.verification||{};
   if(!checked.draft||![v.emailSyntax,v.emailPublished,v.namedContactPublished,v.rolePublished,v.mxVerified,Boolean(v.publishedWorkflow)].every(Boolean)){receipt.holdReason='OFFICIAL_EVIDENCE_NOT_CURRENT';await save('EVIDENCE_HOLD');stats.held++;continue;}
   let marketingBrief=null;
   if(assigned?.marketingContentId){
    const key=v.publishedWorkflow==='CONTACT_REQUEST'?'LEAD_FOLLOWUP':v.publishedWorkflow;
    let [material]=await db('/marketing_content_runs?id=eq.'+encodeURIComponent(assigned.marketingContentId)+'&select=id,workflow,body,distribution_status');
    // Repair old assignments only after current official evidence identifies
    // the workflow. Never send the mismatched asset or relax eligibility.
    if(material&&material.workflow!==key){
     [material]=await db('/marketing_content_runs?workflow=eq.'+encodeURIComponent(key)+'&distribution_status=eq.SALES_QUEUE_READY&order=created_at.desc&limit=1&select=id,workflow,body,distribution_status');
    }
    if(!material?.body||material.distribution_status!=='SALES_QUEUE_READY')throw Error('OUTREACH_MARKETING_MATERIAL_UNAVAILABLE');
    if(material.workflow!==key)throw Error('OUTREACH_MARKETING_WORKFLOW_MISMATCH');
    marketingBrief={id:assigned.marketingBriefId,strategy_version:assigned.marketingStrategyVersion,
      selectedAsset:{id:material.id,key:material.workflow,solution:material.body,cta:''}};
   }
   if(marketingBrief)checked.draft=prepareCampaignDraft(lead,{workflow:v.publishedWorkflow,marketingBrief});
   stats.verified++;
   const [fresh]=await db('/leads?id=eq.'+lead.id+'&select=id,status,commercial_stage,contact_email,source_payload,notes');
   if(!fresh||fresh.status!=='NEW'||fresh.commercial_stage!=='PREPARED'||fresh.contact_email.toLowerCase()!==email||fresh.source_payload?.unsubscribed||fresh.source_payload?.doNotContact||/do not contact|unsubscribe|hard.?bounce/i.test(fresh.notes||'')){stats.held++;continue;}
   if(await suppressionCheck(email,domain)||await command(['GET','dnc:'+email])||await command(['GET','dnc:'+domain])){stats.held++;continue;}
   if((await gmail.search('in:anywhere {to:'+email+' from:'+email+' to:(@'+domain+')}')).length){receipt.holdReason='EXISTING_ACCOUNT_HISTORY';await save('HISTORY_HOLD');stats.held++;continue;}
   if((await gmail.search('in:sent newer_than:1d')).length>=100){stats.held++;continue;}
   const hour=Math.floor(now.getTime()/3600000)*3600000;
   const used=Number(await command(['ZCOUNT','boltech:sdr:jobs',hour,hour+3599999]));if(!Number.isFinite(used)||used>=20){stats.held++;continue;}
   receipt.verification={...v,humanVerified:false,officialSourceReviewed:true,reviewedBy:'AGENT1_OFFICIAL_SOURCE_RULES'};
   receipt.marketingContentId=checked.draft.marketingContentId||null;
   receipt.marketingBriefId=checked.draft.marketingBriefId||null;
   receipt.sendState='SEND_PENDING';receipt.claimedAt=now.toISOString();await save('SEND_PENDING');
   await command(['ZADD','boltech:sdr:jobs',now.getTime(),receipt.rfcMessageId]);
   let sent;
   try{sent=await gmail.send({email,subject:checked.draft.subject,text:checked.draft.body,rfcMessageId:receipt.rfcMessageId});if(!sent.messageId||!sent.threadId)throw Error('OUTREACH_PROVIDER_RECEIPT_MISSING');}
   catch{receipt.sendState='UNKNOWN';await save('UNKNOWN_SEND_STATE');stats.held++;continue;}
   Object.assign(receipt,sent,{sendState:'SENT',sentAt:now.toISOString()});await save('SENT');
   await markContacted(sent);stats.sent++;
  }catch(e){if(e.code==='GMAIL_RATE_LIMITED')throw e;stats.errors.push({leadId:lead.id,error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'OUTREACH_UNCONFIRMED'});stats.held++;}
  finally{if(owned){receipt.leaseUntil=null;const rows=await db(path+'&execution_run_id=eq.'+runId,{method:'PATCH',headers,body:JSON.stringify({execution_receipt:receipt,updated_at:now.toISOString()})});if(rows?.length!==1)throw Error('OUTREACH_LEASE_RELEASE_FAILED');}}
 }
 return {...stats,status:stats.errors.length?'ATTENTION':'COMPLETED',pending:candidates.filter(l=>l.status==='NEW').length};
}

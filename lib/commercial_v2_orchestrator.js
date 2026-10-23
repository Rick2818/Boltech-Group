// Commercial V2 initial-outreach path. Opt-in via server-only feature flag.
// Uses the existing scheduled inbox worker; never creates another scheduler or agent.
import {evaluateRecipientV2} from './commercial_verifier_v2.js';
import {dispatchVerifiedV2,reconcileUnknownV2,deliveryKey} from './commercial_dispatch_v2.js';
import {createCommercialV2Store} from './commercial_v2_supabase_store.js';
import {commercialV2GmailProvider} from './commercial_v2_gmail_provider.js';
import {checkRecipientSuppression} from './agent1_suppression_evidence.js';
import {SDR_SENDER} from './sdr_gmail.js';
import {followupDueAt} from './canonical_followup_sender.js';

export async function runCommercialV2Outreach({leads=[],db,gmail,now=new Date(),env=process.env,store,provider,suppressionProbe=checkRecipientSuppression}={}){
 const report={reviewed:0,eligible:0,sent:0,reconciled:0,held:0,errors:[],providerReceipts:[]};
 if(!db||!gmail)return {...report,errors:[{code:'V2_DEPENDENCY_MISSING'}]};
 const configured=env.COMMERCIAL_V2_SEND_ENABLED==='true';
 const material=await db('/marketing_content_runs?select=id,workflow,body,distribution_status&distribution_status=eq.SALES_QUEUE_READY&limit=100');
 const outbox=store||createCommercialV2Store({url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY});
 const candidates=leads.filter(x=>x.status==='NEW'&&
  ['DRAFT_REVIEW','PREPARED'].includes(x.commercial_stage)&&
  x.contact_email&&x.source_payload?.campaignDraft&&!/QA|SYNTHETIC/i.test(x.data_quality||'')).slice(0,3);
 for(const lead of candidates){
  report.reviewed++;
  try{
   const receipt=await evaluateRecipientV2(lead,{now,marketingRuns:material,
    checkDuplicates:async current=>leads.some(x=>x.id!==current.id&&
     x.contact_email?.toLowerCase()===current.contact_email.toLowerCase()&&
     ['CONTACTED','REPLIED','SUPPRESSED','WON','LOST'].includes(x.status)),
    checkSuppression:async current=>suppressionProbe(current,{leads,now}),
    checkHistory:async email=>{
     await gmail.verify();
     return gmail.search('in:anywhere {to:'+email+' from:'+email+'}');
    },
    policy:async current=>current.country==='US'&&Boolean(current.source_payload?.campaignDraft?.subject)&&
      Boolean(current.source_payload?.campaignDraft?.body)
   });
   // This is an independent V2 gate. Failures must not be used to advance PREPARED.
   if(receipt.status!=='CLEAR'){report.held++;continue;}
   report.eligible++;
   const draft=lead.source_payload.campaignDraft;
   const campaignId=String(lead.id)+':'+String(draft.marketingContentId);
   const key=deliveryKey({sender:SDR_SENDER,recipient:receipt.recipient,campaignId});
   const actualProvider=provider||commercialV2GmailProvider({gmail,campaigns:async id=>id===campaignId?
    {recipient:receipt.recipient,subject:draft.subject,text:draft.body,approved:true}:null});
   const previously=await outbox.get(key);
   if(previously&&['SEND_UNKNOWN','SENDING'].includes(previously.status)){
    const outcome=await reconcileUnknownV2({key,store:outbox,provider:actualProvider});
    if(outcome.status!=='SENT'){report.held++;continue;}
    report.reconciled++;
   }else if(!previously&&!configured){report.held++;continue;}
   if(!previously&&configured){
    const outcome=await dispatchVerifiedV2({receipt,sender:SDR_SENDER,campaignId,store:outbox,provider:actualProvider,
     recheck:async()=>{
      const current=await db('/leads?id=eq.'+encodeURIComponent(lead.id)+'&select=id,status,source_payload');
      if(current?.length!==1||current[0].status!=='NEW'||current[0].source_payload?.leadEvidence?.sendAuthorized!==true)return false;
      const fresh=await suppressionProbe(lead,{leads,now:new Date()});
      if(fresh.status!=='CLEAR')return false;
      await gmail.verify();
      return (await gmail.search('in:anywhere {to:'+receipt.recipient+' from:'+receipt.recipient+'}')).length===0;
     }});
    if(outcome.status!=='SENT'){report.held++;continue;}
   }
   const record=await outbox.get(key);
   if(record?.status!=='SENT'||!record.provider_message_id||!record.provider_thread_id){report.held++;continue;}
   const msg=await gmail.message(record.provider_message_id);
   if(!msg.sent||msg.from!==SDR_SENDER||
     !String(msg.to||'').toLowerCase().includes(receipt.recipient)||
     msg.threadId!==record.provider_thread_id)throw Error('V2_PROVIDER_RECEIPT_MISMATCH');
   const rows=await db('/leads?id=eq.'+encodeURIComponent(lead.id)+'&status=eq.NEW',
    {method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
     body:JSON.stringify({status:'CONTACTED',commercial_stage:'outreach_sent',
      source_payload:{...lead.source_payload,gmail_sent_message_id:msg.id,gmail_thread_id:msg.threadId,
       v2DispatchKey:key,v2MarketingContentId:draft.marketingContentId,v2VerifiedAt:receipt.checkedAt},
      next_action:'First follow-up due '+followupDueAt(msg.receivedAt)+' unless customer replies or opts out.',
      updated_at:now.toISOString()})});
   if(rows?.length!==1)throw Error('V2_CRM_RECEIPT_NOT_CONFIRMED');
   report.sent++;report.providerReceipts.push({leadId:lead.id,messageId:msg.id,threadId:msg.threadId});
  }catch(e){report.errors.push({leadId:lead.id,code:String(e?.message||'V2_EXECUTION_ERROR').replace(/https?:\/\/[^\s]+/g,'[url]').slice(0,80)});}
 }
 return report;
}

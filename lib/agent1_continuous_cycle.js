import {randomUUID} from 'node:crypto';
import {createSdrGmail} from './sdr_gmail.js';
import {reviewCompanyDraft} from './agent1_company_draft_review.js';
import {commercialSchedulerAuthorized} from './commercial_scheduler_auth.js';
import {discoverExpleeResearch,discoverPublicDemand,verifyPublishedCandidate,researchOfficialContact,verifyOfficialCompanyMailbox} from './agent1_continuous_research.js';

// Existing ten-minute executor: discover, deduplicate, verify, prepare, checkpoint.
// There is no research total or fixed lead batch. Pending work survives every run.
const WORK_ID='agent1-continuous-prospecting';
const domain=value=>{try{return new URL(value).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
const safeError=e=>String(e?.message||'RESEARCH_FAILED').replace(/https?:\/\/\S+/g,'[url]').slice(0,100);
export function companyDraftReviewDue(review,now=new Date()){
 if(!review)return true;
 const checkedAt=Date.parse(review.checkedAt);
 // Missing or malformed receipts must not permanently strand a draft.
 return !Number.isFinite(checkedAt)||now.getTime()-checkedAt>=24*3600000;
}
export async function runAgent1Cycle({env=process.env,fetcher=fetch,now=new Date(),clock=Date.now,budgetMs=100000,discoverExplee=discoverExpleeResearch,discoverPublic=discoverPublicDemand,verifyCandidate=verifyPublishedCandidate,researchContact=researchOfficialContact}={}){
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw Error('SALES_CYCLE_CONFIGURATION_MISSING');
 if([...SUPABASE_SERVICE_ROLE_KEY].some(x=>x.codePointAt(0)>255))throw Error('SUPABASE_SERVICE_ROLE_KEY_INVALID_CHARACTERS');
 const root=SUPABASE_URL.replace(/\/$/,'')+'/rest/v1',start=clock(),runId=randomUUID();
 const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY};
 async function call(path,options={}){const r=await fetcher(root+path,{...options,signal:AbortSignal.timeout(10000),headers:{...headers,...options.headers}});if(!r.ok)throw Error('SALES_CYCLE_HTTP_'+r.status);const t=await r.text();return t?JSON.parse(t):null;}
 const jsonHeaders={'Content-Type':'application/json',Prefer:'return=representation'};
 const statePath='/agent_work?work_id=eq.'+WORK_ID;
 await call('/agent_work?on_conflict=work_id',{method:'POST',headers:{...jsonHeaders,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([{work_id:WORK_ID,owner_agent:'AGENT1',status:'ACTIVE',execution_state:'CONTINUOUS_RESEARCH',authorization_note:'Ricardo: prospect continuously 24/7, without a fixed lead batch; prepare canonical queue; no paid source consumption.',next_action:'Resume research and candidate verification each cycle.',execution_receipt:{expleeCursor:0,publicCursor:0},updated_at:now.toISOString()}])});
 const [work]=await call(statePath+'&select=id,updated_at,execution_run_id,execution_receipt');
 const briefs=await call('/marketing_sales_briefs?select=id,strategy_version,message,status,evidence&sales_owner=eq.AGENT_1&limit=1');
 const marketingRuns=await call('/marketing_content_runs?select=id,workflow,subject,body,distribution_status,evidence&distribution_status=eq.SALES_QUEUE_READY&order=created_at.desc&limit=30');
 const marketingBrief=Array.isArray(briefs)?briefs.find(b=>b.status==='READY_FOR_SALES_REVIEW'&&b.message&&b.strategy_version):null;
 if(!work)throw Error('RESEARCH_STATE_MISSING');
 const previous=work.execution_receipt||{};
 if(previous.leaseUntil&&Date.parse(previous.leaseUntil)>now.getTime())return {status:'BUSY',outreachSent:0};
 const state={...previous,runId,leaseUntil:new Date(now.getTime()+240000).toISOString()};
 const leaseFilter=work.execution_run_id?'eq.'+encodeURIComponent(work.execution_run_id):'is.null';
 const lease=await call(statePath+'&execution_run_id='+leaseFilter,{method:'PATCH',headers:jsonHeaders,body:JSON.stringify({execution_run_id:runId,execution_receipt:state,updated_at:now.toISOString()})});
 if(!Array.isArray(lease)||lease.length!==1)return {status:'BUSY',outreachSent:0};
 const report={discovered:0,duplicates:0,verified:0,prepared:0,verificationRetries:0,sources:[],errors:[],outreachSent:0,salesClosed:0,marketingBriefId:marketingBrief?.id||null,marketingStrategyVersion:marketingBrief?.strategy_version||null,marketingAppliedToDrafts:0,marketingContentQueued:Array.isArray(marketingRuns)?marketingRuns.length:0,marketingContentConsumed:0,marketingContentAcknowledged:0,marketingContentAssigned:0,marketingAssetsAvailable:marketingBrief?.evidence?.assets?.length||0,marketingAssetKeys:(marketingBrief?.evidence?.assets||[]).map(x=>x.key)};
 let failure;
 try{
  const leads=[];
  for(let offset=0;;offset+=1000){const page=await call('/leads?select=*&order=id.asc&limit=1000&offset='+offset);if(!Array.isArray(page))throw Error('SALES_CYCLE_INVALID_LEADS');leads.push(...page);if(page.length<1000)break;}
  const emails=new Set(leads.map(x=>String(x.contact_email||'').toLowerCase()).filter(Boolean));
  const domains=new Set(leads.map(x=>domain(x.company_url)).filter(Boolean));
  const ids=new Set(leads.map(x=>x.id));
  async function persistCandidates(candidates){
   for(const p of candidates){
    const host=domain(p.company_url),email=String(p.contact_email||'').toLowerCase();
    if(ids.has(p.id)||(host&&domains.has(host))||(email&&emails.has(email))){report.duplicates++;continue;}
    const rows=await call('/leads?on_conflict=id',{method:'POST',headers:{...jsonHeaders,Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify([{...p,updated_at:now.toISOString()}])});
    if(rows?.length){leads.push(rows[0]);report.discovered++;ids.add(p.id);if(host)domains.add(host);if(email)emails.add(email);}
   }
  }
  // Prioritize converting existing verified-source leads before adding to the backlog.
  // A growing research queue must not be masked by successful discovery calls.
  const backlogCount=leads.filter(x=>x.status==='NEW'&&!['PREPARED','DRAFT_REVIEW'].includes(x.commercial_stage)).length;
  const prioritizeBacklog=backlogCount>=100;
  // Keep discovery alive at a lower cadence while devoting most cycles to verification.
  // No fixed daily lead target: one intake window per hour when backlog is high.
  const intakeWindow=!prioritizeBacklog||now.getUTCMinutes()>=46&&now.getUTCMinutes()<56;
  if(prioritizeBacklog)report.sources.push({status:'BACKLOG_PRIORITY',pending:backlogCount,intakeWindow});
  if(intakeWindow){
  if(!state.expleeRetryAt||Date.parse(state.expleeRetryAt)<=now.getTime()){
   try{const result=await discoverExplee({env,fetcher,cursor:state.expleeCursor||0,now});await persistCandidates(result.candidates);report.sources.push({...result,candidates:undefined});state.expleeCursor=result.nextCursor;state.expleeRetryAt=result.retryAt||null;if(result.creditsCharged>0)state.expleeRetryAt='9999-01-01T00:00:00Z';}
   catch(e){report.errors.push({source:'explee',error:safeError(e)});state.expleeRetryAt=new Date(now.getTime()+3600000).toISOString();}
  }else report.sources.push({status:'EXPLEE_BACKOFF',retryAt:state.expleeRetryAt});
  try{const result=await discoverPublic({fetcher,cursor:state.publicCursor||0,now});await persistCandidates(result.candidates);state.publicCursor=result.nextCursor;report.sources.push({...result,candidates:undefined});}
  catch(e){report.errors.push({source:'public',error:safeError(e)});}
  } // Backlog pressure slows discovery without disabling autonomous intake.
  const pending=leads.filter(x=>x.status==='NEW'&&!['PREPARED','DRAFT_REVIEW'].includes(x.commercial_stage)&&x.source_payload?.research?.contactName&&x.company_url&&(!x.source_payload?.research?.nextReviewAt||Date.parse(x.source_payload.research.nextReviewAt)<=now.getTime()||(x.source_payload?.research?.officialCompanyMailbox&&!x.source_payload?.leadEvidence?.companyMailboxVerification||(x.source_payload?.leadEvidence?.companyMailboxVerification?.status==='OFFICIAL_COMPANY_MAILBOX_VERIFIED'&&!x.source_payload?.companyCampaignDraft)))).sort((a,b)=>String(a.source_payload?.verification?.checkedAt||'').localeCompare(String(b.source_payload?.verification?.checkedAt||'')));
  report.pendingEligible=pending.length;
  report.backlogDue=leads.filter(x=>x.status==='NEW'&&!['PREPARED','DRAFT_REVIEW'].includes(x.commercial_stage)&&x.source_payload?.research?.nextReviewAt&&Date.parse(x.source_payload.research.nextReviewAt)<=now.getTime()).length;
  for(let lead of pending){
   if(clock()-start>=budgetMs)break; // Resume durable queue next run, never stop on lead count.
   try{
    if(!lead.contact_email){
     const companyEmails=Array.isArray(lead.source_payload?.research?.companyContactEmails)?lead.source_payload.research.companyContactEmails:[];
     const companyHost=domain(lead.company_url);
     const valid=companyEmails.map(e=>String(e||'').trim().toLowerCase()).filter(e=>/^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(e)&&e.split('@')[1]===companyHost);
     const named=String(lead.source_payload?.research?.contactName||'').toLowerCase().split(/\\s+/).filter(x=>x.length>=3);
     const personal=valid.filter(e=>{const local=e.split('@')[0].replace(/[^a-z]/g,'');const first=named[0]||'',last=named[named.length-1]||'';return named.some(part=>local.includes(part))||(first.length>1&&last.length>2&&(local===first[0]+last||local===first+last[0]||local===last+first[0]));});
     // Explee company mailbox candidates are evidence for research, not permission to send.
     // Never attribute info@/sales@ or unrelated employee mailboxes to a named buyer.
     if(personal.length===1){
      lead={...lead,source_payload:{...lead.source_payload,research:{...lead.source_payload.research,contactEmailCandidate:personal[0],contactEmailCandidateSource:'EXPLEE_COMPANY_EMAIL_UNVERIFIED'}}};
      report.emailCandidates=(report.emailCandidates||0)+1;
     }
     if(valid.length){report.companyMailboxesFound=(report.companyMailboxesFound||0)+valid.length;}
     lead=await researchContact(lead,{fetcher});
    }
    const workflow=String(lead.source_payload?.research?.workflow||lead.source_payload?.workflow||'').toUpperCase();
    const asset=(marketingBrief?.evidence?.assets||[]).find(x=>x.key===workflow|| (workflow==='CONTACT_REQUEST'&&x.key==='LEAD_FOLLOWUP'));
    const queued=Array.isArray(marketingRuns)?(marketingRuns.find(x=>x.workflow===workflow||(workflow==='CONTACT_REQUEST'&&x.workflow==='LEAD_FOLLOWUP'))||(!workflow?marketingRuns[0]:null)):null;
    if(queued)report.marketingContentAcknowledged++;
    const selectedAsset=queued?{...(asset||{}),id:queued.id,key:queued.workflow,subject:queued.subject,solution:queued.body,cta:asset?.cta||'Would you be open to a short conversation?',proof:'UNVERIFIED'}:asset;
    const salesBrief=selectedAsset?{...marketingBrief,selectedAsset}:marketingBrief;
    const checked=await verifyCandidate(lead,{fetcher,now,marketingBrief:salesBrief});
    const companyMailboxEvidence=lead.source_payload?.research?.officialCompanyMailbox?await verifyOfficialCompanyMailbox(lead,{fetcher,now}):null;
    if(companyMailboxEvidence?.status==='OFFICIAL_COMPANY_MAILBOX_VERIFIED')report.verifiedCompanyMailboxes=(report.verifiedCompanyMailboxes||0)+1;
    // A published, MX-verified shared company mailbox can receive an internal draft,
    // but is NOT an identified buyer and is never eligible for automatic outreach.
    const companyDraft=companyMailboxEvidence?.status==='OFFICIAL_COMPANY_MAILBOX_VERIFIED'?{
      recipient:companyMailboxEvidence.email,recipientType:'OFFICIAL_COMPANY_MAILBOX',
      subject:'Business inquiry workflow at '+lead.name,
      body:'Hello '+lead.name+' team,\\n\\nBoltech Group helps businesses organize incoming inquiries, quotes, and follow-up. Would the team responsible for customer inquiries be open to discussing whether this is relevant?\\n\\nRicardo Bolaños\\nBoltech Group\\nhttps://boltech-group.vercel.app\\n\\nIf this is not relevant, reply no thanks and we will stop contacting you.',
      preparedAt:now.toISOString(),sent:false,sendAuthorized:false,
      requires:['GMAIL_HISTORY','CRM_DUPLICATES','SUPPRESSION_CHECK','RECIPIENT_ELIGIBILITY']
    }:null;
    if(companyDraft)report.companyDraftsPrepared=(report.companyDraftsPrepared||0)+1;
    const evidence={checkedAt:now.toISOString(),source:lead.source,officialWebsite:lead.company_url,sourceEvidenceUrl:lead.source_evidence_url,officialCompanyMailbox:lead.source_payload?.research?.officialCompanyMailbox||null,officialCompanyMailboxEvidence:lead.source_payload?.research?.officialCompanyMailboxEvidence||null,personalCandidate:lead.source_payload?.research?.contactEmailCandidate||null,personalCandidateVerified:checked.verification?.emailPublished===true&&checked.verification?.namedContactPublished===true&&checked.verification?.rolePublished===true&&checked.verification?.mxVerified===true,verificationStatus:checked.status,workflowPublished:checked.verification?.publishedWorkflow||null,sendAuthorized:false,companyMailboxVerification:companyMailboxEvidence};
    const payload={...lead.source_payload,companyCampaignDraft:companyDraft||lead.source_payload?.companyCampaignDraft||null,leadEvidence:evidence,verification:checked.verification,research:{...lead.source_payload.research,marketingContentId:queued?.id||lead.source_payload?.research?.marketingContentId||null,nextReviewAt:new Date(now.getTime()+(checked.draft?6:1)*3600000).toISOString(),verificationError:checked.error||null}};
    if(checked.draft){payload.campaignDraft={...checked.draft,marketingContentId:queued?.id||null};report.prepared++;if(queued)report.marketingContentConsumed++;if(checked.draft.marketingBriefId===marketingBrief?.id)report.marketingAppliedToDrafts++;}else delete payload.campaignDraft;
    if(checked.verification?.mxVerified)report.verified++;
    if(checked.error)report.verificationRetries++;
    const row=await call('/leads?id=eq.'+lead.id+'&status=eq.NEW',{method:'PATCH',headers:jsonHeaders,body:JSON.stringify({contact_email:lead.contact_email||null,source_evidence_url:lead.source_evidence_url,source_payload:payload,data_quality:checked.status,commercial_stage:checked.draft?'PREPARED':companyDraft?'DRAFT_REVIEW':'RESEARCH',next_action:checked.draft?'Reconcile Gmail/CRM history, evidence and suppressions, then release prepared draft for the authorized campaign.':companyDraft?'Internal company-mailbox draft only: reconcile Gmail, CRM, suppressions and recipient eligibility before any release; do not send.':'Continue verifying public contact evidence; do not send.',updated_at:now.toISOString()})});
    if(Array.isArray(row)&&row.length===0)continue;
    if(queued)report.marketingContentAssigned++;
    if(row?.length!==1)throw Error('CANDIDATE_READBACK_MISSING');
    Object.assign(leads.find(x=>x.id===lead.id),row[0]);
   }catch(e){report.errors.push({source:'candidate',id:lead.id,error:safeError(e)});}
  }
  // Autonomous, receipt-backed review of existing company drafts. No outbound action.
  const queuedReviews=leads.filter(x=>x.status==='NEW'&&x.commercial_stage==='DRAFT_REVIEW'&&
    x.source_payload?.companyCampaignDraft&&companyDraftReviewDue(x.source_payload.commercialReview,now)).slice(0,2);
  report.commercialReviewsChecked=0;
  for(const lead of queuedReviews){
   if(clock()-start>=budgetMs)break;
   try{
    const review=await reviewCompanyDraft(lead,{leads,gmail:createSdrGmail(fetcher,env),now});
    const updated=await call('/leads?id=eq.'+lead.id+'&status=eq.NEW&commercial_stage=eq.DRAFT_REVIEW',
      {method:'PATCH',headers:jsonHeaders,body:JSON.stringify({
        source_payload:{...lead.source_payload,commercialReview:review},
        next_action:'Commercial gate: '+review.reason+'; dispatch remains blocked.',
        updated_at:now.toISOString()})});
    if(updated?.length!==1)throw Error('COMMERCIAL_REVIEW_RECEIPT_MISSING');
    Object.assign(lead,updated[0]);report.commercialReviewsChecked++;
    report.commercialReviewLastReason=review.reason;
   }catch(e){report.errors.push({source:'commercial_review',id:lead.id,error:safeError(e)});}
  }
  const valid=leads.filter(x=>!/qa|synthetic/i.test(String(x.data_quality||'')));
  const counts={leads_checked:valid.length,contacted:valid.filter(x=>x.status==='CONTACTED').length,followups_pending:valid.filter(x=>x.status==='CONTACTED'&&Boolean(x.source_payload?.gmail_sent_message_id)&&!['REPLIED','SUPPRESSED','LOST','WON'].includes(String(x.commercial_stage||'').toUpperCase())).length,interested:valid.filter(x=>x.problem_confirmed===true).length};
  report.researchPending=valid.filter(x=>x.status==='NEW'&&!['PREPARED','DRAFT_REVIEW'].includes(x.commercial_stage)).length;
  report.preparedTotal=valid.filter(x=>x.status==='NEW'&&x.commercial_stage==='PREPARED').length;
  const cycleKey=now.toISOString().slice(0,16);
  const row={cycle_key:cycleKey,checked_at:now.toISOString(),...counts,result:'RESEARCH_CYCLE_COMPLETED',details:{...report,source:'supabase',mode:'CONTINUOUS_24_7',researchTotalLimit:null,followupExecution:'OBSERVED_BY_INBOX_EXECUTOR'}};
  await call('/agent1_commercial_cycle_receipts?on_conflict=cycle_key',{method:'POST',headers:{...jsonHeaders,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([row])});
  const receipt=await call('/agent1_commercial_cycle_receipts?cycle_key=eq.'+encodeURIComponent(cycleKey)+'&select=cycle_key,result');
  if(!Array.isArray(receipt)||receipt.length!==1)throw Error('SALES_CYCLE_RECEIPT_MISSING');
  return {status:'RECORDED',...counts,...report,cycleKey,mode:'CONTINUOUS_24_7',researchTotalLimit:null};
 }catch(e){failure=e;throw e;}
 finally{
  state.leaseUntil=null;state.lastCompletedAt=now.toISOString();state.lastReport=report;
  if(failure)state.lastError=safeError(failure);else delete state.lastError;
  const saved=await call(statePath+'&execution_run_id=eq.'+runId,{method:'PATCH',headers:jsonHeaders,body:JSON.stringify({status:'ACTIVE',execution_state:failure?'RETRY_REQUIRED':'CONTINUOUS_RESEARCH',execution_receipt:state,updated_at:now.toISOString()})});
  if(saved?.length!==1)throw Error('RESEARCH_CHECKPOINT_READBACK_MISSING');
 }
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!commercialSchedulerAuthorized(req))return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await runAgent1Cycle())}catch(e){return res.status(503).json({error:safeError(e)})}
}

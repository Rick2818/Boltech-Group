import {randomUUID} from 'node:crypto';
import {positioningForMarketing,BOLTECH_POSITIONING} from './boltech_positioning_v2.js';
import {buildCanonicalMarketingSupport} from './marketing_sales_support.js';
import {createMarketingTrace} from './marketing_trace.js';
import {commercialSchedulerAuthorized} from './commercial_scheduler_auth.js';
import {SDR_SENDER} from './sdr_gmail.js';
import {pilotCommercialTerms} from './commercial_offer.js';
import {campaignLandingUrl} from './marketing_distribution.js';
const pid='managed-ai-operations-v2-us-b2b',prefix='marketing:sales:';
const json={'Content-Type':'application/json',Prefer:'return=representation'};
const eligible=l=>/^(US|USA|United States)$/i.test(l.country||'')&&!/synthetic|qa|test/i.test(l.data_quality||'');
async function pages(db,path){const rows=[];for(let offset=0;;offset+=1000){const p=await db(path+'&limit=1000&offset='+offset);if(!Array.isArray(p))throw Error('MARKETING_ROWS_INVALID');rows.push(...p);if(p.length<1000)return rows;}}
export function createCanonicalMarketing({db,leads,gmail,now=()=>new Date().toISOString()}){
 const eventPath=id=>'/agent_work?work_id=eq.'+encodeURIComponent(id);
 const convert=r=>r?{...r.execution_receipt,eventId:r.work_id,opportunityId:r.lead_id,from:'AGENT1',_revision:r.execution_run_id}:null;
 const readEvent=async id=>{
  if(!id.startsWith(prefix))throw Error('MARKETING_CANONICAL_EVENT_REQUIRED');
  const [r]=await db(eventPath(id)+'&select=work_id,lead_id,owner_agent,execution_run_id,execution_receipt');
  if(r&&(r.owner_agent!=='MARKETING'||r.execution_receipt?.material?.leadId!==r.lead_id))throw Error('MARKETING_CANONICAL_OWNER_MISMATCH');return convert(r);
 };
 const listEvents=async()=> (await pages(db,'/agent_work?owner_agent=eq.MARKETING&work_id=like.marketing:sales:*&select=work_id,lead_id,execution_run_id,execution_receipt&order=work_id.asc')).map(convert);
 async function updateEvent(old,next){
  const derived=new Set(['eventId','opportunityId','from','_revision']);
  const changes=Object.fromEntries(Object.entries(next).filter(([k,v])=>!derived.has(k)&&JSON.stringify(v)!==JSON.stringify(old[k])));
  let current=old;
  for(let attempt=0;attempt<3;attempt++){
   if(current.material.fingerprint!==old.material.fingerprint)throw Error('MARKETING_MATERIAL_VERSION_MISMATCH');
   for(const k of ['marketingUse','marketingResult'])if(changes[k]&&current[k]){if(changes[k].messageId!==current[k].messageId)throw Error('MARKETING_USAGE_CONFLICT');delete changes[k];}
   const receipt={...Object.fromEntries(Object.entries(current).filter(([k])=>!derived.has(k))),...changes};
   const revision=randomUUID(),filter=current._revision?'eq.'+encodeURIComponent(current._revision):'is.null';
   const state=receipt.marketingResult?'CUSTOMER_REPLY_VERIFIED':receipt.marketingUse?'USED_BY_SALES':receipt.marketingReview?'ACCEPTED_BY_SALES':'READY_FOR_SALES_REVIEW';
   const saved=await db(eventPath(old.eventId)+'&execution_run_id='+filter,{method:'PATCH',headers:json,body:JSON.stringify({execution_run_id:revision,execution_receipt:receipt,execution_state:state,status:receipt.marketingUse?'COMPLETED':'PENDING',updated_at:now(),next_action:receipt.marketingResult?'Review the verified customer response; no proposal or payment inferred.':receipt.marketingUse?'Wait for customer response; reconcile real outcomes.':'Agente 1 reviews this material and records actual provider use.'})});
   if(saved?.length===1){const verified=await readEvent(old.eventId);if(verified?._revision===revision)return;}
   current=await readEvent(old.eventId);if(!current)throw Error('MARKETING_WRITE_READBACK_FAILED');
  }
  throw Error('MARKETING_CONCURRENT_UPDATE_RETRY');
 }
 const trace=createMarketingTrace({readEvent,updateEvent,listEvents,lead:async id=>{const l=leads.find(x=>x.id===id);return l?{id:l.id,fields:{'Contact Email':l.contact_email}}:null;},sender:SDR_SENDER,message:async id=>{if(!gmail)throw Error('MARKETING_PROVIDER_READ_REQUIRED');return gmail.message(id);},search:gmail?.search,thread:gmail?.thread,now});
 async function ensure(input){
  const material=buildCanonicalMarketingSupport(input),eventId=prefix+input.lead.id+':'+input.kind.toLowerCase()+':'+material.fingerprint.slice(0,16);
  const receipt={createdAt:now(),materialPreparedAt:now(),material};
  await db('/agent_work?on_conflict=work_id',{method:'POST',headers:{...json,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([{work_id:eventId,lead_id:input.lead.id,owner_agent:'MARKETING',handoff_to:'AGENT1',status:'PENDING',execution_state:'READY_FOR_SALES_REVIEW',execution_receipt:receipt,authorization_note:'Private sales support only; existing contact permissions and provider checks still apply.',next_action:'Agente 1 reviews the opportunity-specific material before any authorized use.',updated_at:now()}])});
  const row=await readEvent(eventId);if(row?.material?.fingerprint!==material.fingerprint)throw Error('MARKETING_MATERIAL_NOT_PERSISTED');
  return {eventId,from:'AGENT1',materialFingerprint:material.fingerprint,material:row.material};
 }
 return {ensure,read:async eventId=>{const row=await readEvent(eventId);if(!row)throw Error('MARKETING_MATERIAL_NOT_FOUND');return {eventId,from:'AGENT1',materialFingerprint:row.material.fingerprint,material:row.material};},
  accept:async(handle,text)=>{if(handle.material.materials[handle.material.language]?.text!==text)throw Error('MARKETING_SALES_TEXT_MISMATCH');return trace.review(handle);},
  use:(handle,messageId)=>trace.use({...handle,messageId,language:handle.material.language}),
  result:async message=>{const rows=(await listEvents()).filter(r=>r.marketingUse?.threadId===message.threadId&&!r.marketingResult);for(const r of rows)await trace.result({eventId:r.eventId,from:'AGENT1',messageId:message.id});return rows.length;},
  reconcile:async()=>{const rows=(await listEvents()).filter(r=>r.marketingReview&&!r.marketingUse);let reconciled=0;for(const row of rows){if(gmail){await trace.reconcile({eventId:row.eventId,from:'AGENT1'});reconciled++;}}return {checked:reconciled};},
  metrics:()=>trace.metrics(),listEvents};
}
export async function runMarketingSalesCycle({env=process.env,fetcher=fetch,db,leads,gmail,now=()=>new Date().toISOString(),clock=Date.now,budgetMs=25000}={}){
 if(!db){
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:key}=env;
  if(!SUPABASE_URL||!key)throw Error('MARKETING_MISSING_SUPABASE_CONFIGURATION');
  if([...key].some(c=>c.codePointAt(0)>255))throw Error('MARKETING_INVALID_SERVICE_KEY_FORMAT');
  db=async(path,options={})=>{const r=await fetcher(SUPABASE_URL.replace(/\/$/,'')+'/rest/v1'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,...options.headers},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('MARKETING_CRM_HTTP_'+r.status);const t=await r.text();return t?JSON.parse(t):null;};
 }
 const start=clock(),rows=leads||await pages(db,'/leads?select=*&order=id.asc'),us=rows.filter(eligible),marketing=createCanonicalMarketing({db,leads:rows,gmail,now});
 let preparedThisCycle=0;
 const prior=new Set((await marketing.listEvents()).map(r=>r.material?.fingerprint));
 // Inbox provides interested buyers and due follow-ups first; remaining prospect
 // preparation is bounded by time, never by an arbitrary number of accounts.
 for(const lead of us.filter(l=>l.status==='NEW'&&l.commercial_stage==='PREPARED'&&l.source_payload?.campaignDraft)){
  if(prior.has(buildCanonicalMarketingSupport({lead,kind:'INITIAL',draft:lead.source_payload.campaignDraft}).fingerprint))continue;
  if(clock()-start>=budgetMs)break;
  await marketing.ensure({lead,kind:'INITIAL',draft:lead.source_payload.campaignDraft});preparedThisCycle++;
 }
 const metrics=await marketing.metrics(),jobs=await pages(db,'/agent1_inbound_sales_jobs?select=lead_id,message_id,stage,action,status&order=message_id.asc');
 const ids=new Set(us.map(l=>l.id)),realJobs=jobs.filter(j=>ids.has(j.lead_id));
 const terms=pilotCommercialTerms(),message=positioningForMarketing();
 const contentText=`Does every quote request have an owner and a next action?\n\nFor US metal fabrication teams, a useful first step is to make each incoming request traceable: record it, assign responsibility and keep the next action visible. A published quote form alone does not tell us whether a business has this problem.\n\nBoltech Group's defined request-intake pilot covers one business, one web workflow and one simple integration. Implementation: USD ${terms.totalAmount}, ${terms.upfrontPercent}% upfront and ${terms.completionPercent}% on verified delivery. Reference delivery: ${terms.deliveryDays} days after scope acceptance, confirmed upfront payment and required access. Tool usage and maintenance are excluded.\n\nWhich handoff would you improve first? Email your workflow and current tools to ricardo.boltechgroup@gmail.com for a written fit review.\n\n${campaignLandingUrl('CUSTOM_AGENTS')}`;
 const existing=await db('/marketing_sales_briefs?id=eq.'+pid+'&select=evidence');
 const funnel={contactsWithProviderReceipt:us.filter(l=>l.source_payload?.gmail_sent_message_id).length,usefulReplyLeads:new Set(realJobs.filter(j=>['PREPARE_SCOPE_QUESTIONS','OFFER_DISCOVERY'].includes(j.action)).map(j=>j.lead_id)).size,materials:metrics,diagnosesCompleted:null,approvedProposals:null,confirmedPayments:null,unverifiedStages:'No linked verification source is counted for diagnosis, proposals or payment.',saleInferred:false};
 const evidence={...existing?.[0]?.evidence,checked_leads:rows.length,us_leads:us.length,confirmed_needs:us.filter(l=>l.problem_confirmed===true).length,positioning:message.angles,claims_not_certified:true,autonomous_send:false,
  strategy:{version:'2026-10-21-canonical-materials',primarySegment:'US metal fabrication with published quote/inquiry workflows',offerId:terms.offerId,offerVersion:terms.offerVersion,implementationUsd:terms.totalAmount,paymentSplit:[terms.upfrontPercent,terms.completionPercent],priority:['Buyer price/scope question','Interested buyer diagnosis','Authorized follow-up','Verified initial outreach','Content for that segment'],nextStep:'Written workflow diagnosis by email; individual scope and feasibility before proposal.',successCriterion:'Verified useful responses and opportunity progress; publications alone are not demand.'},
  funnel,contentPlan:{...existing?.[0]?.evidence?.contentPlan,text:contentText,network:'linkedin',callToAction:'Written workflow diagnosis by email',salesNeed:'Support the same published quote/inquiry workflow segment as Agente 1',draft:true},lastCycleAt:now()};
 const brief={id:pid,strategy_version:BOLTECH_POSITIONING.version,segment:evidence.strategy.primarySegment,message:message.message,proof_status:'MATERIALS_PERSISTED_OUTCOMES_SEPARATE',owner:'MARKETING',sales_owner:'AGENT_1',status:'SALES_SUPPORT_ACTIVE',source_leads:us.length,evidence,updated_at:now()};
 await db('/marketing_sales_briefs?on_conflict=id',{method:'POST',headers:{...json,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([brief])});
 const [saved]=await db('/marketing_sales_briefs?id=eq.'+pid+'&select=id,status,evidence');
 if(saved?.evidence?.lastCycleAt!==evidence.lastCycleAt)throw Error('MARKETING_BRIEF_NOT_PERSISTED');
 return {status:'SALES_SUPPORT_ACTIVE',briefId:pid,sourceLeads:us.length,preparedThisCycle,metrics,funnel,send:false};
}
export default async function marketingCycleHandler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!commercialSchedulerAuthorized(req))return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await runMarketingSalesCycle())}catch(err){return res.status(503).json({error:/^[A-Z0-9_]+$/.test(err.message)?err.message:'MARKETING_CYCLE_UNCONFIRMED'})}
}

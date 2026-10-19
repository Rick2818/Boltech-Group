// Autonomous sales enablement skills. Research/triage only: no outreach or invented sales.
export const MARKETING_SKILLS=Object.freeze([
 'CRM_SEGMENTATION','BUYER_NEED_HYPOTHESES','MESSAGE_PERSONALIZATION',
 'REPLY_TRIAGE_SUPPORT','PROPOSAL_ENABLEMENT','DUPLICATE_SUPPRESSION',
 'CAMPAIGN_PERFORMANCE_REVIEW','BLOCKER_ESCALATION'
]);
const value=v=>String(v||'').trim();
export function planMarketingActions(leads=[],{limit=5}={}){
 const suppressed=f=>f?.Unsubscribed===true||f?.['Do Not Contact']===true||f?.['Data Quality']==='QA'||/bounced|unsubscribe|do not contact|disqualified|synthetic/i.test([f?.Status,f?.['Commercial Stage'],f?.Notes].join(' '));
 const output=[];
 const excludedMarkets=/(?:^|\b)(?:el salvador|salvadoran)(?:\b|$)/i;
 const personalMailboxes=new Set(['rick28191@gmail.com','ricardo.boltechgroup@gmail.com']);
 for(const lead of leads){
  const f=lead.fields||{};if(suppressed(f))continue;
  const email=value(f['Contact Email']).toLowerCase();
  const company=value(f.Name);
  const companyUrl=value(f['Company URL']);
  const source=value(f.Source);
  const domain=(()=>{try{return new URL(companyUrl).hostname.toLowerCase();}catch{return '';}})();
  if(personalMailboxes.has(email)||excludedMarkets.test(value(f.Country))||domain.endsWith('.sv')||domain.endsWith('.com.sv')||/^(?:tu chuchito|cliente sint[eé]tico|synthetic customer)$/i.test(company)||(/web/i.test(source)&&personalMailboxes.has(email)))continue;
  const stage=value(f['Commercial Stage']);
  const replied=/replied|meeting held|proposal sent|won unpaid/i.test(stage);
  const contacted=/contacted|waiting.?response/i.test(stage)||/\[(?:SDR_SENT|RSI01_FOLLOWUP):/.test(value(f.Notes));
  const kind=replied?'RESPONDED_LEAD_NEEDS_DIAGNOSIS':contacted?'CONTACTED_LEAD_NEEDS_THREAD_REVIEW':email?'RESEARCH_AND_PERSONALIZE':'COMPLETE_CONTACT_RESEARCH';
  const owner=replied?'RSI-02':'RSI-01';
  output.push({leadId:lead.id,company:value(f.Name).slice(0,100),owner,kind,priority:replied?1:contacted?2:3,channel:'INTERNAL_ONLY',nextAction:replied?'Analyze the verified customer reply and prepare qualification questions.':contacted?'Verify Gmail thread and determine whether an authorized follow-up is due.':email?'Verify source evidence and tailor subject to observed business workflow.':'Research a valid, published business contact before proposing outreach.',customerNeedVerified:f['Problem Confirmed']===true});
 }
 output.sort((a,b)=>a.priority-b.priority||a.leadId.localeCompare(b.leadId));
 return {skills:[...MARKETING_SKILLS],observed:output.length,selected:output.slice(0,Math.max(0,Math.min(limit,5))),requiresSalesExecution:true,sendingPerformed:false,customerInterestInferred:false};
}

/**
 * Marketing owns positioning, campaign design and enablement, not lead sourcing.
 * This creates deterministic internal briefs from existing, validated signals.
 * Never represents a hypothesis as a verified buyer need.
 */
export function buildMarketingBrief(plan,{at='2026-10-19T00:00:00Z'}={}){
 const selected=Array.isArray(plan?.selected)?plan.selected:[];
 const segments=[
  {id:'CUSTOM_AGENTS',offer:'Custom AI agents',audience:'B2B teams with complex quoting, inquiries or support handoffs',message:'Reduce repetitive handoffs with a scoped AI workflow pilot.'},
  {id:'PREBUILT_AGENTS',offer:'Prebuilt AI agents',audience:'B2B teams with a defined, repeatable workflow',message:'Launch a bounded workflow without committing to a custom build.'}
 ];
 const campaigns=segments.map(s=>({
  id:s.id,owner:'MARKETING',audience:s.audience,offer:s.offer,
  positioning:s.message,headline:s.id==='CUSTOM_AGENTS'?'Automate the bottleneck, not the entire business':'Start with one workflow that matters',
  channel:'INTERNAL_ENABLEMENT',status:'DRAFT_REVIEW_REQUIRED',
  creative:{emailSubject:s.id==='CUSTOM_AGENTS'?'A workflow pilot for your team':'One repeatable task, automated',
   landingPageAngle:s.message,cta:'Request a scoped workflow assessment'},
  distributionOwner:'RSI-01',qualificationOwner:'RSI-02',closingOwner:'RSI-03',
  metrics:{source:'VERIFIED_RECEIPTS_ONLY',sent:null,replies:null,qualified:null,proposals:null,paid:null}
 }));
 return {schemaVersion:1,owner:'MARKETING',createdAt:at,skillsPackaged:[
  'CRM_SEGMENTATION','BUYER_NEED_HYPOTHESES','MESSAGE_PERSONALIZATION',
  'REPLY_TRIAGE_SUPPORT','PROPOSAL_ENABLEMENT','DUPLICATE_SUPPRESSION',
  'CAMPAIGN_PERFORMANCE_REVIEW','BLOCKER_ESCALATION'],
  customerNeedConfirmed:false,leadSourcingPerformed:false,sendingPerformed:false,
  segments,campaigns,enablement:selected.map(item=>({
   leadId:item.leadId,recipient:item.owner,priority:item.priority,
   recommendation:item.nextAction,needStatus:item.customerNeedVerified?'CRM_FLAG_REQUIRES_SOURCE_EVIDENCE':'HYPOTHESIS',
   channel:'INTERNAL_ONLY'})),
  performance:{state:'AWAITING_PROVIDER_RECEIPTS',reason:'Do not infer campaign reach, replies or ROI'},
  director:{status:'REVIEW_REQUIRED',requiresEvidence:true,supervise:['CAMPAIGN_ADOPTION','DELIVERABLE_APPROVAL','RESPONSE_METRICS']}
 };
}

export function marketingBriefForRole(work,role){
 if(!['RSI-01','RSI-02','RSI-03'].includes(role))return {status:'INVALID_ROLE',brief:null};
 const row=(work||[]).find(w=>w?.fields?.['Work ID']==='BOOTSTRAP:MARKETING');
 const raw=String(row?.fields?.Evidence||'');
 const match=raw.match(/\[MARKETING_TEAM_SUPPORT_V1\]\s*([\s\S]*?)\s*\[\/MARKETING_TEAM_SUPPORT_V1\]/);
 if(!match)return {status:'NOT_PUBLISHED',brief:null};
 try{
  const packet=JSON.parse(match[1]);
  const brief=packet.marketingBrief;
  if(brief?.owner!=='MARKETING'||brief.schemaVersion!==1||brief.sendingPerformed!==false||!Array.isArray(brief.campaigns))return {status:'INVALID_PACKET',brief:null};
  return {status:'AVAILABLE_FOR_REVIEW',brief:{campaigns:brief.campaigns.map(c=>({id:c.id,positioning:c.positioning,creative:c.creative,status:c.status})), recommendations:(brief.enablement||[]).filter(e=>e.recipient===role),approvalRequired:true,sendingAuthorized:false}};
 }catch{return {status:'INVALID_PACKET',brief:null};}
}

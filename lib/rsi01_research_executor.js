import {investigatePublicSite,safeCompanySite} from './rsi01_public_research.js';
// RSI-01 research executor: bounded, evidence-based case assessment. Never authorizes outreach.
const allowed=new Set(['PENDING_RSI01_RESEARCH','BLOCKED_FIT_RESEARCH','CONTACT_DRAFT_READY_REVIEW','RESEARCH_EVIDENCE_PENDING','RESEARCH_RETRY_1','RESEARCH_RETRY_2']);
// Discover research-ready CRM companies not yet assigned an RSI-01 work item.
// This does not fabricate new companies or infer purchasing intent.
export function discoverResearchCandidates(leads,work,{limit=5}={}){
 const existing=new Set(work.map(w=>w.fields?.['Source Record ID']).filter(Boolean));
 return leads.filter(l=>l?.id&&!existing.has(l.id)&&l.fields?.['Data Quality']!=='QA'&&
  !l.fields?.['Do Not Contact']&&!l.fields?.Unsubscribed&&
  !/do not contact|unsubscribed|bounced/i.test(String(l.fields?.['Commercial Stage']||''))&&
  !!safeCompanySite(l.fields?.['Company URL'],l.fields?.['Contact Email']))
  .sort((a,b)=>Number(b.fields?.Country==='United States'||b.fields?.Country==='USA')-
   Number(a.fields?.Country==='United States'||a.fields?.Country==='USA')||a.id.localeCompare(b.id))
  .slice(0,limit);
}
export async function seedResearchQueue({leads,work,request,limit=5}){
 const candidates=discoverResearchCandidates(leads,work,{limit}),added=[];
 for(const lead of candidates){
  const fields={'Work ID':`RSI-01:AUTORESEARCH:${lead.id}`,RSI:'RSI-01',Status:'PENDING_RSI01_RESEARCH','Source Record ID':lead.id,
   Evidence:'[RSI01_DISCOVERY] Existing CRM company with valid matched HTTPS domain; operational need not confirmed.',
   'Next Action':'RSI-01: inspect company public pages and document actual source evidence. No outbound.'};
  const r=await request('tblHVqUMifOFjlGvj',{method:'POST',body:{records:[{fields}]}});
  if(!r.records?.[0]?.id)throw Error('RSI01_DISCOVERY_WRITE_UNCONFIRMED');
  added.push({id:r.records[0].id,fields});
 }
 return added;
}
export function buildCommercialReviewPacket(lead,publicResearch){
 const signals=Array.isArray(publicResearch?.operationalSignals)?publicResearch.operationalSignals:[];

 const f=lead?.fields||{};
 return {leadId:lead?.id,company:f.Name||null,companyUrl:publicResearch?.url||null,
  signals:signals.map(x=>({category:x.type,url:x.sourceUrl||publicResearch.url,excerpt:x.excerpt||''})),
  buyerVerified:Boolean(f['Buyer Role']),contactRecorded:Boolean(f['Contact Email']),
  customerNeedConfirmed:f['Problem Confirmed']===true,
  status:signals.length?'REVIEW_REQUIRED':'INSUFFICIENT_EVIDENCE',
  contactEligible:false,salesReview:{accepted:false},sendingEnabled:false};
}
export function assessCase(work,lead){
 const f=lead?.fields||{},w=work?.fields||{};
 if(w.RSI!=='RSI-01'||!allowed.has(w.Status)||w['Source Record ID']!==lead?.id)return null;
 const notes=String(f.Notes||'')+' '+String(w.Evidence||'');
 const reasons=[];
 if(!String(f['Contact Email']||'').includes('@'))reasons.push('MISSING_CONTACT_EMAIL');
 if(!String(f['Company URL']||'').startsWith('https://'))reasons.push('MISSING_COMPANY_SOURCE');
 if(!f['Buyer Role'])reasons.push('BUYER_ROLE_UNVERIFIED');
 if(!f['Source Evidence URL'])reasons.push('INDEPENDENT_COMPANY_EVIDENCE_MISSING');
 if(f['Problem Confirmed']!==true)reasons.push('CUSTOMER_NEED_UNCONFIRMED');
 if(f['Data Quality']==='QA'||/synthetic|sint[eé]tico|cliente de prueba/i.test(notes))reasons.push('SYNTHETIC_EXCLUDED');
 if(/do not contact|unsubscrib|opt.?out|hard.?bounce|suppressed/i.test(notes))reasons.push('CONTACT_EXCLUDED');
 return {id:work.id,leadId:lead.id,status:reasons.length?'RESEARCH_EVIDENCE_PENDING':'COMMERCIAL_APPROVAL_REVIEW',reasons,approvalGranted:false,sendingEnabled:false};
}
function wStatus(previous,next){return previous==='CONTACT_DRAFT_READY_REVIEW'?'CONTACT_DRAFT_READY_REVIEW':next}
export async function executeResearch({work,leads,request,now=()=>new Date().toISOString(),limit=5,investigate=investigatePublicSite}){
 if(!Array.isArray(work)||!Array.isArray(leads)||typeof request!=='function')throw Error('RESEARCH_EXECUTOR_INVALID_INPUT');
 const map=new Map(leads.map(l=>[l.id,l])),decisions=[],failures=[];
 // Process unassessed cases first, then the least recently reviewed. Without
 // this rotation a daily limit of five repeatedly checks the same five cases.
 const assessmentMarker='[RSI01_RESEARCH_ASSESSMENT_V1]';
 const queue=work.filter(row=>{const lead=map.get(row.fields?.['Source Record ID']);return assessCase(row,lead)&&!!safeCompanySite(lead?.fields?.['Company URL'],lead?.fields?.['Contact Email'])&&lead?.fields?.['Data Quality']!=='QA'&& !String(row.fields?.Evidence||'').includes('"at":"'+now().slice(0,10));})
   .sort((a,b)=>{
     const aLead=map.get(a.fields?.['Source Record ID'])?.fields||{},bLead=map.get(b.fields?.['Source Record ID'])?.fields||{};
     const aReady=!!safeCompanySite(aLead['Company URL'],aLead['Contact Email'])&&aLead['Data Quality']!=='QA';
     const bReady=!!safeCompanySite(bLead['Company URL'],bLead['Contact Email'])&&bLead['Data Quality']!=='QA';
     if(aReady!==bReady)return aReady?-1:1;
     const first=a.fields?.Evidence?.includes(assessmentMarker)?1:0;
     const second=b.fields?.Evidence?.includes(assessmentMarker)?1:0;
     if(first!==second)return first-second;
     const aTime=Date.parse(a.fields?.['Updated At']||'')||0;
     const bTime=Date.parse(b.fields?.['Updated At']||'')||0;
     return aTime-bTime||String(a.id).localeCompare(String(b.id));
   });
 for(const row of queue){if(decisions.length>=limit)break;const d=assessCase(row,map.get(row.fields?.['Source Record ID']));if(!d)continue;
  let publicResearch;
  try{publicResearch=await investigate(map.get(d.leadId));}catch{failures.push({leadId:d.leadId,code:'PUBLIC_RESEARCH_FETCH_FAILED'});continue;}
  const signals=Array.isArray(publicResearch?.operationalSignals)?publicResearch.operationalSignals:[];
  const reviewPacket=buildCommercialReviewPacket(map.get(d.leadId),publicResearch);
  const commercialPhase=d.reasons.includes('CONTACT_EXCLUDED')||d.reasons.includes('SYNTHETIC_EXCLUDED')?'EXCLUDED':d.reasons.includes('CUSTOMER_NEED_UNCONFIRMED')?(signals.length?'POTENTIAL_NEED_SOURCE_OBSERVED':'RESEARCH_NEED_EVIDENCE'):'BUYER_NEED_VERIFIED_REQUIRES_APPROVAL';
  const stamp=now(),previous=String(row.fields.Evidence||'');
  const marker='[RSI01_RESEARCH_ASSESSMENT_V1]';
  const evidence=previous.replace(/\[RSI01_RESEARCH_ASSESSMENT_V1\][\s\S]*?\[\/RSI01_RESEARCH_ASSESSMENT_V1\]/g,'').trim()+'\n'+marker+JSON.stringify({at:stamp,leadId:d.leadId,reasons:d.reasons,commercialPhase,reviewPacket,publicResearch,approvalGranted:false})+'[/RSI01_RESEARCH_ASSESSMENT_V1]';
  const fields={Status:wStatus(row.fields.Status,d.status),Evidence:evidence,'Updated At':stamp,'Next Action':d.reasons.length?(commercialPhase==='EXCLUDED'?'RSI-01: excluded; do not contact.':commercialPhase==='POTENTIAL_NEED_SOURCE_OBSERVED'?'RSI-01: inspect documented process signals, identify accountable buyer, seek human confirmation of need; send only after separate authorization.':'RSI-01: research public process evidence and buyer identity; customer need not confirmed. No outbound.'):'DIRECTORA: verify contact and authorize case-specific outreach. No automatic approval.'};
  try{
   const p=await request('tblHVqUMifOFjlGvj',{method:'PATCH',body:{records:[{id:d.id,fields}]}});
   if(p.records?.[0]?.id!==d.id)throw Error('RESEARCH_EXECUTOR_WRITE_UNCONFIRMED');
  }catch{failures.push({leadId:d.leadId,code:'RESEARCH_EXECUTOR_WRITE_UNCONFIRMED'});continue;}
  decisions.push({...d,commercialPhase,signals:signals.map(x=>x.type),publicResearchState:publicResearch.state});
 }
 return {assessed:decisions.length,failed:failures.length,failures,skippedUnresearchable:work.filter(row=>{const lead=map.get(row.fields?.['Source Record ID']);return assessCase(row,lead)&&!safeCompanySite(lead?.fields?.['Company URL'],lead?.fields?.['Contact Email']);}).length,opportunitiesWithEvidence:decisions.filter(d=>d.signals.length>0).length,pending:decisions.filter(d=>d.reasons.length).length,readyForApproval:decisions.filter(d=>!d.reasons.length).length,decisions,sendingEnabled:false};
}

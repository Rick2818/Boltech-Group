// V2 verification contract: fail closed. This module does not dispatch mail.
export const OUTCOME=Object.freeze({CLEAR:'CLEAR',BLOCKED:'BLOCKED',REVIEW_REQUIRED:'REVIEW_REQUIRED'});
const asEmail=x=>String(x||'').trim().toLowerCase();
const hostname=x=>{try{return new URL(x).hostname.replace(/^www\./,'').toLowerCase();}catch{return ''}};
const isFresh=(value,now,maxAge=86400000)=>{const t=Date.parse(value||'');return Number.isFinite(t)&&t<=now.getTime()&&now.getTime()-t<=maxAge};
export function canonicalCommercialDraft(lead){
 const payload=lead?.source_payload||{},company=payload.companyCampaignDraft;
 return company?.recipientType==='OFFICIAL_COMPANY_MAILBOX'&&asEmail(company.recipient)===asEmail(lead.contact_email)?company:payload.campaignDraft;
}
export async function evaluateRecipientV2(lead,{now=new Date(),checkSuppression,checkHistory,checkDuplicates,marketingRuns=[],policy}={}){
 const email=asEmail(lead?.contact_email),payload=lead?.source_payload||{},v=payload.verification||{},proof=payload.leadEvidence||{},draft=canonicalCommercialDraft(lead);
 const receipt={version:'2.1',leadId:lead?.id||null,recipient:email,checkedAt:now.toISOString(),status:OUTCOME.REVIEW_REQUIRED,sendAuthorized:false,checks:{}};
 const hold=(reason,status=OUTCOME.REVIEW_REQUIRED)=>({...receipt,status,reason});
 if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))return hold('INVALID_RECIPIENT',OUTCOME.BLOCKED);
 const host=hostname(lead.company_url);
 const companyProof=proof.companyMailboxVerification||{};
 const companyPath=draft?.recipientType==='OFFICIAL_COMPANY_MAILBOX'&&asEmail(draft.recipient)===email;
 const sourceUrl=companyPath?companyProof.sourceUrl:lead.source_evidence_url;
 const source=hostname(sourceUrl);
 if(!host||!source||host!==source||!email.endsWith('@'+host)||!String(sourceUrl||'').startsWith('https://'))return hold('OFFICIAL_SOURCE_MISMATCH');
 if(!isFresh(companyPath?companyProof.checkedAt:v.checkedAt,now))return hold('OFFICIAL_EVIDENCE_STALE');
 const named=!companyPath&&Boolean(v.emailSyntax&&v.emailPublished&&v.namedContactPublished&&v.rolePublished&&v.mxVerified&&proof.personalCandidateVerified);
 const shared=companyPath&&companyProof.status==='OFFICIAL_COMPANY_MAILBOX_VERIFIED'&&
  asEmail(companyProof.email)===email&&companyProof.published===true&&companyProof.mxVerified===true&&companyProof.domainMatches===true;
 if(!named&&!shared)return hold('BUYER_OR_COMPANY_MAILBOX_NOT_VERIFIED');
 receipt.checks.identity=named?'NAMED_BUYER':'OFFICIAL_COMPANY_MAILBOX';
 if(!draft||draft.sent!==false||!draft.marketingContentId)return hold('CANONICAL_DRAFT_MISSING');
 const flow=v.publishedWorkflow==='CONTACT_REQUEST'?'LEAD_FOLLOWUP':v.publishedWorkflow;
 const material=marketingRuns.find(x=>x.id===draft.marketingContentId);
 if(!flow||!material||material.workflow!==flow||material.distribution_status!=='SALES_QUEUE_READY'||!material.body)return hold('MARKETING_EVIDENCE_MISSING');
 receipt.checks.marketingContentId=material.id;
 if(typeof checkDuplicates!=='function'||typeof checkSuppression!=='function'||typeof checkHistory!=='function')return hold('REQUIRED_CHECKER_UNAVAILABLE');
 try{
  const duplicates=await checkDuplicates(lead);
  if(duplicates!==false){receipt.checks.duplicates=duplicates===true?'FOUND':'UNKNOWN';return hold('CRM_DUPLICATE_OR_UNKNOWN',duplicates===true?OUTCOME.BLOCKED:OUTCOME.REVIEW_REQUIRED);}
  receipt.checks.duplicates='CLEAR';
 }catch{return hold('CRM_UNAVAILABLE');}
 try{
  const exclusion=await checkSuppression(lead,{now});
  receipt.checks.suppression=exclusion?.status||'UNAVAILABLE';
  if(exclusion?.status==='BLOCKED')return hold('DNC_MATCH',OUTCOME.BLOCKED);
  if(exclusion?.status!=='CLEAR'||!isFresh(exclusion.checkedAt,now,600000)||asEmail(exclusion.recipient)!==email)return hold('DNC_EVIDENCE_UNAVAILABLE');
 }catch{return hold('DNC_EVIDENCE_UNAVAILABLE');}
 try{
  const history=await checkHistory(email);
  if(!Array.isArray(history))return hold('GMAIL_HISTORY_UNAVAILABLE');
  receipt.checks.gmail=history.length?'HISTORY_FOUND':'CLEAR';
  if(history.length)return hold('PRIOR_GMAIL_CONTACT',OUTCOME.BLOCKED);
 }catch{return hold('GMAIL_HISTORY_UNAVAILABLE');}
 // Independent V2 policy replaces the legacy recipientEligibility/sendAuthorized
 // fields. An explicit scoped authorization decision is still mandatory.
 if(typeof policy!=='function')return hold('V2_POLICY_UNAVAILABLE');
 try{
  const decision=await policy(lead,receipt);
  if(!decision||decision.authorized!==true||decision.eligible!==true||!decision.policyId)
   return hold('V2_POLICY_NOT_AUTHORIZED');
  receipt.checks.policyId=decision.policyId;
 }catch{return hold('V2_POLICY_UNAVAILABLE');}
 return {...receipt,status:OUTCOME.CLEAR,reason:'ALL_GATES_CLEARED',sendAuthorized:true};
}

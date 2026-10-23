import {createSdrGmail} from './sdr_gmail.js';

// Evidence gate for official shared inboxes. This is not an outbound authorization.
// Supabase is the canonical CRM. Legacy Airtable-based dispatch is NOT eligible.
export async function reviewCompanyDraft(lead,{leads=[],gmail=createSdrGmail(),now=new Date()}={}){
 const draft=lead.source_payload?.companyCampaignDraft;
 const proof=lead.source_payload?.leadEvidence?.companyMailboxVerification;
 const receipt={checkedAt:now.toISOString(),recipient:draft?.recipient||null,
   verifiedOfficialMailbox:proof?.status==='OFFICIAL_COMPANY_MAILBOX_VERIFIED',
   gmail:'NOT_CHECKED',supabaseDuplicates:'NOT_CHECKED',
   crm:'NOT_CHECKED',suppression:'NOT_CHECKED',sendAuthorized:false,
   executor:'SUPABASE_DISPATCH_NOT_CONFIGURED',result:'BLOCKED'};
 if(!draft||!receipt.verifiedOfficialMailbox||draft.recipient!==proof.email||
    draft.recipientType!=='OFFICIAL_COMPANY_MAILBOX')return {...receipt,reason:'OFFICIAL_MAILBOX_EVIDENCE_MISSING'};
 const email=draft.recipient.toLowerCase();
 if(leads.some(x=>x.id!==lead.id&&x.contact_email?.toLowerCase()===email&&
      ['CONTACTED','REPLIED','SUPPRESSED','WON','LOST'].includes(String(x.status).toUpperCase())))
   return {...receipt,supabaseDuplicates:'FOUND',reason:'EXISTING_CRM_HISTORY'};
 receipt.supabaseDuplicates='CLEAR';
 try{
  await gmail.verify();
  const existing=await gmail.search('in:anywhere {to:'+email+' from:'+email+'}');
  receipt.gmail=existing.length?'HISTORY_FOUND':'CLEAR';
  if(existing.length)return {...receipt,reason:'GMAIL_HISTORY_FOUND'};
 }catch(e){return {...receipt,gmail:'RETRY_REQUIRED',reason:'GMAIL_READ_UNAVAILABLE'};}
 // Canonical CRM is Supabase. Require explicit eligibility and suppression
 // evidence; generic mailbox discovery alone never grants send authority.
 const eligibility=lead.source_payload?.recipientEligibility;
 const suppression=lead.source_payload?.suppressionCheck;
 receipt.crm=eligibility?.approved===true?'ELIGIBLE':'REVIEW_REQUIRED';
 receipt.suppression=suppression?.status==='CLEAR'?'CLEAR':'REVIEW_REQUIRED';
 if(receipt.crm!=='ELIGIBLE'||receipt.suppression!=='CLEAR')
   return {...receipt,reason:'SUPABASE_ELIGIBILITY_OR_SUPPRESSION_NOT_CLEARED'};
 // Legacy SDR dispatch writes to Airtable. Fail closed until a Supabase-native
 // idempotent dispatch and provider reconciliation are implemented and certified.
 return {...receipt,reason:'SUPABASE_DISPATCH_NOT_CONFIGURED'};
}


// Named-buyer review uses the existing Agent 1 queue; it never infers
// permission to send from a published email or a completed research draft.
export async function reviewNamedBuyerDraft(lead,{leads=[],gmail=createSdrGmail(),marketingRuns=[],now=new Date(),suppressionProbe=null}={}){
 const payload=lead.source_payload||{},draft=payload.campaignDraft,v=payload.verification||{},proof=payload.leadEvidence||{};
 const email=String(lead.contact_email||'').trim().toLowerCase();
 const receipt={checkedAt:now.toISOString(),recipient:email||null,marketingContentId:draft?.marketingContentId||null,
  officialEvidence:'NOT_CHECKED',marketing:'NOT_CHECKED',gmail:'NOT_CHECKED',supabaseDuplicates:'NOT_CHECKED',
  crm:'NOT_CHECKED',suppression:'NOT_CHECKED',sendAuthorized:false,result:'BLOCKED'};
 let host,sourceHost;
 try{host=new URL(lead.company_url).hostname.replace(/^www\./,'').toLowerCase();
     sourceHost=new URL(lead.source_evidence_url).hostname.replace(/^www\./,'').toLowerCase();}
 catch{return {...receipt,reason:'OFFICIAL_SOURCE_MISSING'};}
 const verifiedAt=Date.parse(v.checkedAt);
 const fresh=Number.isFinite(verifiedAt)&&verifiedAt<=now.getTime()&&now.getTime()-verifiedAt<=24*3600000;
 const official=fresh&&host===sourceHost&&email.endsWith('@'+host)&&
  [v.emailSyntax,v.emailPublished,v.namedContactPublished,v.rolePublished,v.mxVerified,Boolean(v.publishedWorkflow)].every(Boolean)&&
  proof.personalCandidateVerified===true&&draft?.sent===false;
 if(!official)return {...receipt,reason:'NAMED_BUYER_EVIDENCE_NOT_CURRENT'};
 receipt.officialEvidence='VERIFIED';
 const duplicates=leads.some(x=>x.id!==lead.id&&
  (String(x.contact_email||'').toLowerCase()===email||
   (x.company_url&&(()=>{try{return new URL(x.company_url).hostname.replace(/^www\./,'').toLowerCase()===host;}catch{return false;}})()))&&
  ['CONTACTED','REPLIED','SUPPRESSED','WON','LOST'].includes(String(x.status).toUpperCase()));
 receipt.supabaseDuplicates=duplicates?'FOUND':'CLEAR';
 if(duplicates)return {...receipt,reason:'EXISTING_CRM_HISTORY'};
 const workflow=v.publishedWorkflow==='CONTACT_REQUEST'?'LEAD_FOLLOWUP':v.publishedWorkflow;
 const material=marketingRuns.find(x=>x.id===draft?.marketingContentId);
 if(!material||material.workflow!==workflow||material.distribution_status!=='SALES_QUEUE_READY'||!material.body)
  return {...receipt,marketing:'NOT_READY',reason:'MARKETING_ASSET_NOT_VERIFIED'};
 receipt.marketing='VERIFIED';receipt.marketingWorkflow=workflow;
 try{
  await gmail.verify();
  const hits=await gmail.search('in:anywhere {to:'+email+' from:'+email+' to:(@'+host+')}');
  receipt.gmail=hits.length?'HISTORY_FOUND':'CLEAR';
  if(hits.length)return {...receipt,reason:'GMAIL_HISTORY_FOUND'};
 }catch{return {...receipt,gmail:'RETRY_REQUIRED',reason:'GMAIL_READ_UNAVAILABLE'};}
 let suppression=payload.suppressionCheck;
 if(suppressionProbe){
  try{suppression=await suppressionProbe(lead,{leads,now});receipt.suppressionEvidence=suppression;}
  catch{return {...receipt,reason:'SUPPRESSION_CHECK_UNAVAILABLE'};}
 }
 receipt.crm=payload.recipientEligibility?.approved===true?'ELIGIBLE':'REVIEW_REQUIRED';
 receipt.suppression=suppression?.status==='CLEAR'?'CLEAR':'REVIEW_REQUIRED';
 if(suppression?.status==='BLOCKED')return {...receipt,reason:'SUPPRESSION_LIST_MATCH'};
 if(receipt.crm!=='ELIGIBLE'||receipt.suppression!=='CLEAR')
  return {...receipt,reason:'SUPABASE_ELIGIBILITY_OR_SUPPRESSION_NOT_CLEARED'};
 if(proof.sendAuthorized!==true)return {...receipt,reason:'OUTBOUND_AUTHORIZATION_REQUIRED'};
 return {...receipt,sendAuthorized:true,result:'ELIGIBLE',reason:'NAMED_BUYER_REVIEW_APPROVED'};
}

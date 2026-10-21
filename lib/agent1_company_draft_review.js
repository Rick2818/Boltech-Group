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

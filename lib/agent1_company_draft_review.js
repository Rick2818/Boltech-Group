import {createSdrGmail} from './sdr_gmail.js';

// Evidence gate for official shared inboxes. This is not an outbound authorization.
// The existing SDR dispatcher still owns the irreversible send and CRM receipt.
export async function reviewCompanyDraft(lead,{leads=[],gmail=createSdrGmail(),now=new Date()}={}){
 const draft=lead.source_payload?.companyCampaignDraft;
 const proof=lead.source_payload?.leadEvidence?.companyMailboxVerification;
 const receipt={checkedAt:now.toISOString(),recipient:draft?.recipient||null,
   verifiedOfficialMailbox:proof?.status==='OFFICIAL_COMPANY_MAILBOX_VERIFIED',
   gmail:'NOT_CHECKED',supabaseDuplicates:'NOT_CHECKED',
   crm:'NOT_CHECKED',suppression:'NOT_CHECKED',sendAuthorized:false,
   executor:'SDR_DISPATCH',result:'BLOCKED'};
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
 // No Airtable record or accepted sales eligibility can be inferred from Supabase.
 // Do not upgrade a generic mailbox to a named buyer or bypass suppression controls.
 const research=lead.source_payload?.commercialResearch;
 const id=lead.source_payload?.airtableRecordId;
 if(!/^rec[a-zA-Z0-9]+$/.test(String(id||''))||
   research?.salesReview?.accepted!==true||
   lead.source_payload?.contactEligible!==true)
   return {...receipt,crm:'REVIEW_REQUIRED',suppression:'REVIEW_REQUIRED',reason:'CRM_ELIGIBILITY_NOT_APPROVED'};
 return {...receipt,crm:'PENDING_CURRENT_HISTORY',suppression:'PENDING_CURRENT_CHECK',reason:'SDR_PREFLIGHT_REQUIRED'};
}

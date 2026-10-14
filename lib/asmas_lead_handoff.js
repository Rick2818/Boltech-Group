// Safe, read-only candidate gate for ASMAS -> RSI-01. No CRM writes or sends.
import {normalizeApolloDomain} from './apollo_client.js';
const blocked=/\b(qa|synthetic|sint[eé]tico|test)\b/i;
const norm=v=>String(v||'').trim().toLowerCase();
export function planLeadHandoff({contacts=[],existing=[],limit=5}={}){
 if(!Array.isArray(contacts)||!Array.isArray(existing)||!Number.isInteger(limit)||limit<1||limit>5)throw Error('LEAD_HANDOFF_INVALID_INPUT');
 const emails=new Set(),domains=new Set();
 for(const row of existing){
  const f=row.fields||row;
  if(f['Contact Email']||f.contactEmail)emails.add(norm(f['Contact Email']||f.contactEmail));
  const d=f['Company URL']||f.domain||f['Company Domain'];
  if(d){try{domains.add(normalizeApolloDomain(d));}catch{}}
 }
 const candidates=[],rejected=[];
 for(const c of contacts){
  const email=norm(c.contactEmail), domain=norm(c.domain);
  let reason='';
  if(c.source!=='APOLLO_SAVED_CONTACT')reason='UNVERIFIED_SOURCE';
  else if(c.country && !/^(united states|usa|us|estados unidos)$/i.test(c.country.trim()))reason='OUTSIDE_PREFERRED_MARKET';
  else if(!email||!domain||!c.company||!c.name||!c.title)reason='INSUFFICIENT_CONTACT_EVIDENCE';
  else if(c.verified!==true||c.emailValidation?.mailboxConfirmed!==true)reason='CONTACT_NOT_VERIFIED';
  else if(blocked.test([c.name,c.company,c.title].join(' ')))reason='SYNTHETIC_EXCLUDED';
  else if(emails.has(email)||domains.has(domain))reason='DUPLICATE_OR_EXISTING_ACCOUNT';
  if(reason){rejected.push({leadId:c.leadId||null,reason});continue;}
  emails.add(email);domains.add(domain);
  if(candidates.length<limit)candidates.push({leadId:c.leadId,contactEmail:email,company:c.company,domain,owner:'RSI-01',status:'REQUIRES_CRM_PERSISTENCE_AND_AUTHORIZATION',sendingEnabled:false});
 }
 return {owner:'DIRECTORA',route:'APOLLO_SAVED_CONTACTS_TO_RSI_01',mode:'READ_ONLY_PREVIEW',candidates,rejected,readyForAutomaticHandoff:false,sendingEnabled:false,blockers:['CRM_PERSISTENCE_NOT_IMPLEMENTED','SEND_AUTHORIZATION_NOT_VERIFIED']};
}

import {readFileSync} from 'node:fs';
import {redisCommand} from './rsi_handoff_store.js';

// Existing DNC/CRM/Redis sources only. Never infer an outbound approval.
export async function checkRecipientSuppression(lead,{now=new Date(),leads=[],command=redisCommand,read=readFileSync}={}){
 const email=String(lead.contact_email||'').trim().toLowerCase();
 const domain=email.split('@')[1]||'';
 const result={status:'REVIEW_REQUIRED',checkedAt:now.toISOString(),recipient:email,domain,
   sources:['pipeline/dnc_blacklist.json','pipeline/master_suppression_registry.json','supabase/leads','redis/dnc'],
   reason:'SUPPRESSION_EVIDENCE_UNAVAILABLE'};
 if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))return {...result,reason:'RECIPIENT_INVALID'};
 if(lead.source_payload?.doNotContact||lead.source_payload?.unsubscribed||
    /do not contact|unsubscribe|hard.?bounce/i.test(lead.notes||''))
   return {...result,status:'BLOCKED',reason:'LEAD_SUPPRESSION_FLAG'};
 if(leads.some(x=>x.id!==lead.id&&(String(x.contact_email||'').trim().toLowerCase()===email||
   (()=>{try{return new URL(x.company_url).hostname.replace(/^www\./,'').toLowerCase()===domain;}catch{return false;}})())&&
   (['CONTACTED','REPLIED','SUPPRESSED','WON','LOST'].includes(String(x.status||'').toUpperCase())||
    x.source_payload?.doNotContact||x.source_payload?.unsubscribed)))
   return {...result,status:'BLOCKED',reason:'CRM_ACCOUNT_OR_SUPPRESSION_HISTORY'};
 try{
  const local=JSON.parse(read(new URL('../pipeline/dnc_blacklist.json',import.meta.url),'utf8'));
  const master=JSON.parse(read(new URL('../pipeline/master_suppression_registry.json',import.meta.url),'utf8'));
  if(!Array.isArray(local)||!Array.isArray(master.emails)||!Array.isArray(master.domains)||!Array.isArray(master.companies))
   throw Error('INVALID_SUPPRESSION_REGISTRY');
  const norm=x=>String(x||'').trim().toLowerCase();
  const match=local.some(x=>norm(x.email)===email||norm(x.domain)===domain)||
   master.emails.some(x=>norm(x)===email)||master.domains.some(x=>norm(x)===domain)||
   master.companies.some(x=>norm(x)===norm(lead.name));
  if(match)return {...result,status:'BLOCKED',reason:'PERSISTED_SUPPRESSION_MATCH'};
  const emailDnc=await command(['GET','dnc:'+email]);
  const domainDnc=await command(['GET','dnc:'+domain]);
  if(emailDnc||domainDnc)return {...result,status:'BLOCKED',reason:'DISTRIBUTED_SUPPRESSION_MATCH'};
  // Both Redis reads and both local registries must succeed to claim CLEAR.
  return {...result,status:'CLEAR',reason:'ALL_AVAILABLE_SUPPRESSION_SOURCES_CLEAR'};
 }catch{return {...result,reason:'SUPPRESSION_EVIDENCE_UNAVAILABLE'};}
}

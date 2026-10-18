import crypto from 'node:crypto';
import {campaignDay} from './rsi01_daily_campaign.js';
import {safeCompanySite} from './rsi01_public_research.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const marker=/\[SDR_CANDIDATE_V1\][\s\S]*?\[\/SDR_CANDIDATE_V1\]/g;
export function createLeadPreparation({command,listLeads,readLead,writeLead,investigate,validateEmail,gmail,apollo,now=()=>new Date().toISOString()}) {
 const key=()=>`boltech:rsi01:five:${campaignDay(now())}`;
 const empty=()=>({day:campaignDay(now()),target:5,state:'PREPARING',selected:[],rejected:[],attempts:0,source:'EXISTING_UNCONTACTED_CRM'});
 async function status(){const raw=await command(['GET',key()]);return raw?JSON.parse(raw):empty();}
 async function run(){
  const ledger=key(),lock=ledger+':lock',lease=crypto.randomUUID();
  if(await command(['SET',lock,lease,'NX','PX',240000])!=='OK')fail('PREPARATION_BUSY');
  let row=await status();
  const save=async()=>{row.updatedAt=now();const out=await command(['EVAL',"if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 'LEASE_LOST' end redis.call('SET',KEYS[2],ARGV[2]); return 'OK'",2,lock,ledger,lease,JSON.stringify(row)]);if(out!=='OK')fail('PREPARATION_LEASE_LOST');};
  try {
   if(row.state==='READY'&&row.selected.length===5)return {...row,reused:true};
   const all=await listLeads();
   const excluded=f=>String(f.Country||'').toLowerCase()==='el salvador'||/\.sv(?:\/|$)/i.test(String(f['Company URL']||''))||f['Data Quality']==='QA'||f['Do Not Contact']||f.Unsubscribed||/\b(?:SENT|contacted|UNKNOWN|SEND_PENDING|SUPPRESSED|bounced|unsubscribed|do not contact|synthetic|sint[eé]tico)\b/i.test([f.Name,f.Status,f['Commercial Stage'],f.Notes].join(' '));
   const chosen=new Set(row.selected.map(s=>s.domain)),tried=new Set(row.rejected.map(r=>r.recordId));
   const candidates=all.filter(l=>!excluded(l.fields||{})&&safeCompanySite(l.fields?.['Company URL'],l.fields?.['Contact Email'])&&!row.selected.some(s=>s.recordId===l.id)&&!tried.has(l.id)&&!chosen.has(new URL(l.fields['Company URL']).hostname.replace(/^www\./,''))).sort((a,b)=>Number(String(b.fields.Notes||'').includes('[DAILY_SEED:'+row.day+']'))-Number(String(a.fields.Notes||'').includes('[DAILY_SEED:'+row.day+']')));
   if(!candidates.length){row.state='BLOCKED';row.code='SOURCE_EXHAUSTED_BEFORE_FIVE';await save();return row;}
   // Missing provider access is a task blocker, never empty/clear history.
   if((await gmail.verify())?.verified!==true)fail('GMAIL_PROFILE_UNVERIFIED');const batch=await apollo();if(batch.complete!==true||!Array.isArray(batch.contacts))fail('APOLLO_HISTORY_UNCONFIRMED');
   const apolloDomains=new Set(batch.contacts.map(c=>c.domain));
   for(const lead of candidates){
    const f=lead.fields,domain=new URL(f['Company URL']).hostname.replace(/^www\./,'');
    if(chosen.has(domain))continue;
    row.attempts++;
    try {
     if(apolloDomains.has(domain))fail('APOLLO_SAVED_ACCOUNT_REVIEW_REQUIRED');
     const research=await investigate(lead),signal=research.operationalSignals?.[0];
     if(research.state!=='PUBLIC_WEBSITE_OBSERVED'||!signal?.sourceUrl)fail('PUBLIC_PROCESS_EVIDENCE_MISSING');
     if(!research.contactEvidence?.some(e=>e.email===f['Contact Email'].toLowerCase()&&e.basis==='OFFICIAL_PUBLICATION'))fail('OFFICIAL_CONTACT_PUBLICATION_MISSING');
     const mx=await validateEmail(f['Contact Email']);if(mx.mx!==true)fail('EMAIL_MX_UNVERIFIED');
     const email=f['Contact Email'].toLowerCase();
     const history=await gmail.search(`in:anywhere {to:${email} from:${email} to:(@${domain})}`);if(!Array.isArray(history))fail('GMAIL_HISTORY_UNCONFIRMED');if(history.length)fail('EXISTING_GMAIL_ACCOUNT_HISTORY');
     const company=String(f.Name||'').trim();if(!company)fail('COMPANY_NAME_MISSING');
     const observation=`Your public website includes ${signal.type.toLowerCase().replaceAll('_',' ')}.`;
     const individualMessage=`Hello ${company} team,\n\n${observation}\n\nBoltech Group builds custom agents to help organize incoming requests, collect missing details and route them to the right person. Is manual handling of these requests a bottleneck for your team? If relevant, reply with the current steps and we can outline a suitable scope in writing.\n\nThis is an initial inquiry; we have not confirmed a problem in your business. If this is not relevant, let us know and we will not follow up.\n\nRicardo — Boltech Group`;
     const stamp=now();
     const candidate={recordId:lead.id,email,subject:`${company}: handling incoming requests`,status:'READY_FOR_CONTACT',contactEligible:true,preparationDay:row.day,commercialResearch:{channelVerified:true,channelBasis:'Official published business contact; MX only, mailbox not guaranteed',contactRole:'Published business contact; individual buyer authority unconfirmed',observation,hypothesis:'Manual request handling may benefit from automation; ask, do not assert',sources:[...new Set([signal.sourceUrl,...research.contactEvidence.map(e=>e.url)])],accountKey:domain,individualMessage,salesReview:{accepted:true,reviewedBy:'RICARDO_SCOPED_POLICY_20261018_AUTOMATED_CHECKS',reviewedAt:stamp,humanIndividualApproval:false},history:{checkedAt:stamp,gmail:'CLEAR',apollo:'CLEAR',crm:'CLEAR',suppression:'CLEAR',apolloBasis:'Complete saved-contact inventory; account absent, not a claim about deleted or external history'},mailboxConfirmed:false,needConfirmed:false}};
     const notes=String(f.Notes||'').replace(marker,'').trim()+`\n[SDR_CANDIDATE_V1]${JSON.stringify(candidate)}[/SDR_CANDIDATE_V1]`;
     await writeLead(lead.id,{Notes:notes,'Experiment Cohort':'RSI-01','Next Action':'Initial written inquiry prepared under Ricardo scoped policy; no customer need inferred.'});
     const saved=await readLead(lead.id);if(!String(saved.fields?.Notes||'').includes(JSON.stringify(candidate)))fail('CRM_PREPARATION_READBACK_FAILED');
     row.selected.push({recordId:lead.id,domain,email,company,preparedAt:stamp});chosen.add(domain);
    }catch(e){row.rejected.push({recordId:lead.id,code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'PREPARATION_UNCONFIRMED',at:now()});}
    row.state=row.selected.length===5?'READY':'PREPARING';delete row.code;await save();
    // One evidence investigation per invocation; caller resumes durable progress.
    break;
   }
   return row;
  }catch(e){row.state='BLOCKED';row.code=/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'PREPARATION_SOURCE_UNAVAILABLE';await save();return row;}
  finally{await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,lock,lease]);}
 }
 return {run,status};
}

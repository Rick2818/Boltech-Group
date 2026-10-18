// Campaign uses existing SDR sender. Only explicit, individually approved RSI-01 records.
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function extractApprovedCandidate(row){
 const f=row?.fields||{},m=String(f.Notes||'').match(/\[SDR_CANDIDATE_V1\]([\s\S]*?)\[\/SDR_CANDIDATE_V1\]/);
 if(!m||f['Do Not Contact']||f.Unsubscribed||f['Data Quality']==='QA'||!/^RSI-01(?: US)?$/.test(String(f['Experiment Cohort']||'')))return null;
 let c;try{c=JSON.parse(m[1])}catch{return null}
 if(c?.recordId!==row.id||String(c.email||'').toLowerCase()!==String(f['Contact Email']||'').toLowerCase())return null;
 if(c?.status!=='READY_FOR_CONTACT'||c?.contactEligible!==true||c?.commercialResearch?.salesReview?.accepted!==true)return null;
 if(/SENT|UNKNOWN|SEND_PENDING|SUPPRESSED|bounce|disqualified|contacted/i.test([f.Status,f['Commercial Stage'],f.Notes.replace(m[0],'')].join(' ')))return null;
 return c;
}
export async function runApprovedCampaign({listLeads,send,reconcile,maxPerCycle=5}={}){
 if(typeof listLeads!=='function'||typeof send!=='function'||!Number.isInteger(maxPerCycle)||maxPerCycle<1||maxPerCycle>5)fail('CAMPAIGN_INVALID_INPUT');
 const all=await listLeads();if(!Array.isArray(all))fail('CAMPAIGN_INVALID_SOURCE');
 const approved=all.map(extractApprovedCandidate).filter(Boolean);
 const eligible=approved.slice(0,maxPerCycle);
 const results=[];
 for(const candidate of eligible){
  try{const r=await send(candidate);let status=r?.job?.state||'UNKNOWN',reconciliation='NOT_REQUIRED';
   if(['UNKNOWN','SEND_PENDING'].includes(status)&&r?.job?.id&&typeof reconcile==='function'){
    try{const checked=await reconcile(r.job.id);status=checked?.state||status;reconciliation=checked?.reconciliation||'RECONCILIATION_CHECKED';}
    catch{reconciliation='RECONCILIATION_UNAVAILABLE';}
   }
   results.push({recordId:candidate.recordId,status,attempted:r?.attempted===true,reconciliation});}
  catch(e){results.push({recordId:candidate.recordId,status:'BLOCKED',code:e.code||'CAMPAIGN_SEND_UNCONFIRMED'});}
 }
 return {reviewed:all.length,eligible:eligible.length,approvedTotal:approved.length,pendingApproval:all.length-approved.length,results,sendingConfigured:true,unapprovedExcluded:true,cycleStatus:approved.length===0?'NO_APPROVED_LEADS':results.some(x=>['UNKNOWN','BLOCKED','SEND_PENDING','FAILED'].includes(x.status))?'ATTENTION':'EXECUTED'};
}

// Validate the whole prepared cohort before the first send. Provider failures may
// still produce partial delivery; those remain ATTENTION, never exact-five success.
export async function runExactlyFiveCampaign({selected,listLeads,send,reconcile,validate}={}){
 const all=await listLeads(),ids=new Set((selected||[]).map(x=>x.recordId));
 const rows=all.filter(l=>ids.has(l.id)),candidates=rows.map(extractApprovedCandidate).filter(Boolean);
 const prepared=new Map((selected||[]).map(x=>[x.recordId,x]));
 let current=selected?.length===5&&ids.size===5&&rows.length===5&&candidates.length===5&&candidates.every(c=>c.email===prepared.get(c.recordId)?.email&&c.commercialResearch?.accountKey===prepared.get(c.recordId)?.domain)&&new Set(candidates.map(c=>c.commercialResearch.accountKey)).size===5;
 try{if(current)for(const candidate of candidates)validate(candidate);}catch{current=false;}
 if(!current){
  const alreadyContacted=rows.filter(row=>/SENT|SEND_PENDING|UNKNOWN|Contacted|EXTERNAL_GMAIL_SENT/i.test([row.fields?.Status,row.fields?.['Commercial Stage'],String(row.fields?.Notes||'').replace(/\[SDR_CANDIDATE_V1\][\s\S]*?\[\/SDR_CANDIDATE_V1\]/g,'')].join(' '))).length;
  if(alreadyContacted===0)return {reviewed:rows.length,approvedTotal:candidates.length,eligible:0,results:[],cycleStatus:'NO_APPROVED_LEADS',code:'FIVE_CURRENT_APPROVED_CONTACTS_REQUIRED'};
  return {reviewed:rows.length,approvedTotal:candidates.length,alreadyContacted,remaining:Math.max(0,5-alreadyContacted),eligible:0,results:[],cycleStatus:'ATTENTION',code:'FIVE_COHORT_RECONCILIATION_REQUIRED'};
 }
 return runApprovedCampaign({listLeads:async()=>rows,send,reconcile,maxPerCycle:5});
}

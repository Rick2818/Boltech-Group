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
export async function runApprovedCampaign({listLeads,send,maxPerCycle=5}={}){
 if(typeof listLeads!=='function'||typeof send!=='function'||!Number.isInteger(maxPerCycle)||maxPerCycle<1||maxPerCycle>5)fail('CAMPAIGN_INVALID_INPUT');
 const all=await listLeads();if(!Array.isArray(all))fail('CAMPAIGN_INVALID_SOURCE');
 const eligible=all.map(extractApprovedCandidate).filter(Boolean).slice(0,maxPerCycle);
 const results=[];
 for(const candidate of eligible){
  try{const r=await send(candidate);results.push({recordId:candidate.recordId,status:r?.job?.state||'UNKNOWN',attempted:r?.attempted===true});}
  catch(e){results.push({recordId:candidate.recordId,status:'BLOCKED',code:e.code||'CAMPAIGN_SEND_UNCONFIRMED'});}
 }
 return {reviewed:all.length,eligible:eligible.length,results,sendingConfigured:true,unapprovedExcluded:true};
}

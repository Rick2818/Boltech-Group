// ASMAS RSI-01 bounded investigation watchdog. No emails, billing or model calls.
export function researchDecision(fields, nowMs=Date.now()){
 const status=String(fields.Status||'');
 if(!['BLOCKED_FIT_RESEARCH','RESEARCH_RETRY_1','RESEARCH_RETRY_2'].includes(status))return null;
 const stamp=Date.parse(fields['Updated At']||'');
 if(!Number.isFinite(stamp))return {status:'DIRECTOR_REVIEW_REQUIRED',attempt:0,reason:'MISSING_REVIEW_TIMESTAMP'};
 if(nowMs-stamp<86400000)return null;
 const attempt=status==='BLOCKED_FIT_RESEARCH'?1:status==='RESEARCH_RETRY_1'?2:3;
 return attempt>=3?{status:'DIRECTOR_REVIEW_REQUIRED',attempt,reason:'RESEARCH_RETRIES_EXHAUSTED'}:{status:'RESEARCH_RETRY_'+attempt,attempt,reason:'RESEARCH_REVIEW_DUE'};
}
export async function advanceResearchQueue({work,request,now=()=>new Date().toISOString()}){
 const changes=[];
 for(const row of work.filter(r=>r.fields?.RSI==='RSI-01')){
  const decision=researchDecision(row.fields,Date.parse(now()));
  if(!decision)continue;
  const evidence=(row.fields.Evidence||'')+'\n[ASMAS_RESEARCH_WATCHDOG] '+JSON.stringify({decision,at:now(),priorStatus:row.fields.Status});
  const fields={Status:decision.status,'Updated At':now(),Evidence:evidence,'Next Action':decision.status==='DIRECTOR_REVIEW_REQUIRED'?'DIRECTORA: decide exclude or authorize targeted investigation. Do not leave pending indefinitely; no outbound.':'RSI-01: retry evidence gathering; verify fit, real buyer and public sources. No outbound.'};
  const res=await request('tblHVqUMifOFjlGvj',{method:'PATCH',body:{records:[{id:row.id,fields}]}});
  if(res.records?.[0]?.id!==row.id)throw Object.assign(new Error('ASMAS_RESEARCH_UPDATE_UNCONFIRMED'),{code:'ASMAS_RESEARCH_UPDATE_UNCONFIRMED'});
  changes.push({id:row.id,status:fields.Status});
 }
 return changes;
}

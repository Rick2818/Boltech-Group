const TABLE='tblHVqUMifOFjlGvj';
const fail=code=>{throw Object.assign(Error(code),{code});};
export async function workRequest({id,fields,offset,leadId}={}){
 if(fields)fail('FOLLOWUP_WORK_UNSAFE_WRITE');
 const token=process.env.AIRTABLE_TOKEN||process.env.AIRTABLE_PAT;
 if(!token)fail('FOLLOWUP_WORK_UNAVAILABLE');
 const url=new URL(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID||'appCQZd0IhBHFoZ9P'}/${TABLE}${id?'/'+id:''}`);
 if(!id){url.searchParams.set('pageSize','100');url.searchParams.set('filterByFormula',`{Source Record ID}='${leadId}'`);if(offset)url.searchParams.set('offset',offset);}
 const response=await fetch(url,{method:fields?'PATCH':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(fields?{body:JSON.stringify({fields})}:{}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)fail('FOLLOWUP_WORK_UNAVAILABLE');
 return response.json();
}
// Airtable PATCH has no shared version condition across commercial writers.
// Observe only: a receipt must never overwrite mutable Status or Evidence.
export async function syncFollowupWork(job,{request=workRequest}={}){
 if(!/^rec[a-zA-Z0-9]{14}$/.test(job.recordId))fail('FOLLOWUP_WORK_INVALID_LEAD');
 if(job.state!=='SENT'||!job.messageId||!job.threadId)return {state:'PRESERVED'};
 const rows=[],seen=new Set();let offset;
 do{
  const page=await request({leadId:job.recordId,offset});
  if(!Array.isArray(page.records))fail('FOLLOWUP_WORK_INVALID_RESPONSE');
  rows.push(...page.records);offset=page.offset;
  if(offset&&(seen.has(offset)||seen.size>=20))fail('FOLLOWUP_WORK_PAGINATION');
  if(offset)seen.add(offset);
 }while(offset);
 const matches=rows.filter(r=>r.fields?.['Source Record ID']===job.recordId&&r.fields.RSI==='RSI-01'&&!/^(BOOTSTRAP:|TEAM:|RUN:)/.test(r.fields['Work ID']||''));
 if(matches.length!==1)fail('FOLLOWUP_WORK_RECONCILE_REQUIRED');
 const current=await request({id:matches[0].id}),f=current.fields||{};
 if(f['Source Record ID']!==job.recordId||f.RSI!=='RSI-01'||f['Work ID']!==matches[0].fields['Work ID'])fail('FOLLOWUP_WORK_CHANGED');
 if(!['PENDING_RSI01_RESEARCH','WAITING_RESPONSE'].includes(f.Status))return {state:'PRESERVED',workRecordId:current.id};
 const marker=`[FOLLOWUP_WORK_RECEIPT:${job.messageId}]`;
 const evidence=f.Evidence||'';
 if(f.Status==='WAITING_RESPONSE'&&evidence.includes(marker))return {state:'VERIFIED',workRecordId:current.id};
 return {state:'RECONCILE_REQUIRED',workRecordId:current.id,reason:'SHARED_WRITERS_WITHOUT_CONDITIONAL_UPDATE'};
}

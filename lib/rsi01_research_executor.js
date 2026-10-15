// RSI-01 research executor: bounded, evidence-based case assessment. Never authorizes outreach.
const allowed=new Set(['PENDING_RSI01_RESEARCH','BLOCKED_FIT_RESEARCH']);
export function assessCase(work,lead){
 const f=lead?.fields||{},w=work?.fields||{};
 if(w.RSI!=='RSI-01'||!allowed.has(w.Status)||w['Source Record ID']!==lead?.id)return null;
 const notes=String(f.Notes||'')+' '+String(w.Evidence||'');
 const reasons=[];
 if(!String(f['Contact Email']||'').includes('@'))reasons.push('MISSING_CONTACT_EMAIL');
 if(!String(f['Company URL']||'').startsWith('https://'))reasons.push('MISSING_COMPANY_SOURCE');
 if(!f['Buyer Role'])reasons.push('BUYER_ROLE_UNVERIFIED');
 if(!f['Source Evidence URL'])reasons.push('INDEPENDENT_COMPANY_EVIDENCE_MISSING');
 if(f['Problem Confirmed']!==true)reasons.push('CUSTOMER_NEED_UNCONFIRMED');
 if(f['Data Quality']==='QA'||/synthetic|sint[eé]tico|cliente de prueba/i.test(notes))reasons.push('SYNTHETIC_EXCLUDED');
 if(/do not contact|unsubscrib|opt.?out|hard.?bounce|suppressed/i.test(notes))reasons.push('CONTACT_EXCLUDED');
 return {id:work.id,leadId:lead.id,status:reasons.length?'RESEARCH_EVIDENCE_PENDING':'COMMERCIAL_APPROVAL_REVIEW',reasons,approvalGranted:false,sendingEnabled:false};
}
export async function executeResearch({work,leads,request,now=()=>new Date().toISOString(),limit=30}){
 if(!Array.isArray(work)||!Array.isArray(leads)||typeof request!=='function')throw Error('RESEARCH_EXECUTOR_INVALID_INPUT');
 const map=new Map(leads.map(l=>[l.id,l])),decisions=[];
 for(const row of work){if(decisions.length>=limit)break;const d=assessCase(row,map.get(row.fields?.['Source Record ID']));if(!d)continue;
  const stamp=now(),previous=String(row.fields.Evidence||'');
  const marker='[RSI01_RESEARCH_ASSESSMENT_V1]';
  const evidence=previous.replace(/\[RSI01_RESEARCH_ASSESSMENT_V1\][\s\S]*?\[\/RSI01_RESEARCH_ASSESSMENT_V1\]/g,'').trim()+'\n'+marker+JSON.stringify({at:stamp,leadId:d.leadId,reasons:d.reasons,approvalGranted:false})+'[/RSI01_RESEARCH_ASSESSMENT_V1]';
  const fields={Status:d.status,Evidence:evidence,'Updated At':stamp,'Next Action':d.reasons.length?'RSI-01: gather independent sources and buyer evidence; DIRECTORA reviews unresolved gaps. No outbound.':'DIRECTORA: verify contact and authorize case-specific outreach. No automatic approval.'};
  const p=await request('tblHVqUMifOFjlGvj',{method:'PATCH',body:{records:[{id:d.id,fields}]}});
  if(p.records?.[0]?.id!==d.id)throw Error('RESEARCH_EXECUTOR_WRITE_UNCONFIRMED');
  decisions.push(d);
 }
 return {assessed:decisions.length,pending:decisions.filter(d=>d.reasons.length).length,readyForApproval:decisions.filter(d=>!d.reasons.length).length,decisions,sendingEnabled:false};
}

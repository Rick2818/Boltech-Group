// Pure, auditable B2B content quality and topic strategy. No network or publishing side effects.
import {createHash} from 'node:crypto';

export const B2B_TOPICS=Object.freeze([
 'MANUFACTURING_RFQ','INDUSTRIAL_OPERATIONS','ERP_CRM_INTEGRATION',
 'LOGISTICS_AUTOMATION','CUSTOMER_SUPPORT','AI_AGENT_GOVERNANCE',
 'AUTOMATION_ROI','API_WORKFLOWS','TECHNOLOGY_COMPARISON',
 'B2B_SALES_OPERATIONS','SECURITY_AND_COMPLIANCE','IMPLEMENTATION_ROADMAP'
]);
const normalize=s=>String(s||'').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export function contentFingerprint(value){
 return createHash('sha256').update(normalize(value)).digest('hex');
}
export function assessB2BContent(item,{previous=[]}={}){
 const issues=[];
 const text=String(item?.body||'').trim();
 const title=String(item?.subject||'').trim();
 if(text.length<450)issues.push('INSUFFICIENT_DEPTH');
 if(!item?.industry)issues.push('INDUSTRY_MISSING');
 if(!item?.buyerRole)issues.push('BUYER_ROLE_MISSING');
 if(!item?.businessProblem)issues.push('BUSINESS_PROBLEM_MISSING');
 if(!item?.proposedSolution)issues.push('SOLUTION_MISSING');
 if(!Array.isArray(item?.sources)||item.sources.length===0)issues.push('SOURCES_MISSING');
 if(!Array.isArray(item?.kpis)||item.kpis.length===0)issues.push('KPI_MISSING');
 if(!B2B_TOPICS.includes(item?.topic))issues.push('TOPIC_INVALID');
 const hash=contentFingerprint(title+' '+text);
 if(previous.some(p=>contentFingerprint((p.subject||'')+' '+(p.body||''))===hash))issues.push('DUPLICATE');
 if(/\b(guaranteed|100% ROI|certified results)\b/i.test(text))issues.push('UNSUPPORTED_CLAIM_REVIEW');
 return {approved:issues.length===0,issues,fingerprint:hash};
}
export function selectB2BTopic({history=[],demand={},performance={}}={}){
 const recent=history.slice(-12).map(x=>typeof x==='string'?x:x.topic);
 return B2B_TOPICS.map((topic,index)=>{
  const count=recent.filter(x=>x===topic).length;
  const demandScore=Math.max(0,Math.min(10,Number(demand[topic])||0));
  const performanceScore=Math.max(0,Math.min(10,Number(performance[topic])||0));
  return {topic,score:demandScore*3+performanceScore-6*count,index};
 }).sort((a,b)=>b.score-a.score||a.index-b.index)[0].topic;
}
export function decideMarketingRSI({baseline,candidate,minSamples=5}={}){
 const valid=x=>x&&Number.isFinite(x.qualifiedLeads)&&Number.isFinite(x.samples)&&Number.isFinite(x.cost);
 if(!valid(baseline)||!valid(candidate)||baseline.samples<minSamples||candidate.samples<minSamples)
  return {decision:'HOLD',reason:'INSUFFICIENT_EVIDENCE'};
 const baselineRate=baseline.qualifiedLeads/baseline.samples;
 const candidateRate=candidate.qualifiedLeads/candidate.samples;
 if(candidateRate>baselineRate&&candidate.cost<=baseline.cost)return {decision:'ADOPT',reason:'BETTER_QUALIFIED_LEAD_RATE'};
 return {decision:'REVERT',reason:'NO_MEASURED_IMPROVEMENT'};
}

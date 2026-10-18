// Autonomous sales enablement skills. Research/triage only: no outreach or invented sales.
export const MARKETING_SKILLS=Object.freeze([
 'CRM_SEGMENTATION','BUYER_NEED_HYPOTHESES','MESSAGE_PERSONALIZATION',
 'REPLY_TRIAGE_SUPPORT','PROPOSAL_ENABLEMENT','DUPLICATE_SUPPRESSION',
 'CAMPAIGN_PERFORMANCE_REVIEW','BLOCKER_ESCALATION'
]);
const value=v=>String(v||'').trim();
export function planMarketingActions(leads=[],{limit=5}={}){
 const suppressed=f=>f?.Unsubscribed===true||f?.['Do Not Contact']===true||f?.['Data Quality']==='QA'||/bounced|unsubscribe|do not contact|disqualified|synthetic/i.test([f?.Status,f?.['Commercial Stage'],f?.Notes].join(' '));
 const output=[];
 for(const lead of leads){
  const f=lead.fields||{};if(suppressed(f))continue;
  const stage=value(f['Commercial Stage']);
  const replied=/replied|meeting held|proposal sent|won unpaid/i.test(stage);
  const contacted=/contacted|waiting.?response/i.test(stage)||/\[(?:SDR_SENT|RSI01_FOLLOWUP):/.test(value(f.Notes));
  const email=value(f['Contact Email']);
  const kind=replied?'RESPONDED_LEAD_NEEDS_DIAGNOSIS':contacted?'CONTACTED_LEAD_NEEDS_THREAD_REVIEW':email?'RESEARCH_AND_PERSONALIZE':'COMPLETE_CONTACT_RESEARCH';
  const owner=replied?'RSI-02':'RSI-01';
  output.push({leadId:lead.id,company:value(f.Name).slice(0,100),owner,kind,priority:replied?1:contacted?2:3,channel:'INTERNAL_ONLY',nextAction:replied?'Analyze the verified customer reply and prepare qualification questions.':contacted?'Verify Gmail thread and determine whether an authorized follow-up is due.':email?'Verify source evidence and tailor subject to observed business workflow.':'Research a valid, published business contact before proposing outreach.',customerNeedVerified:f['Problem Confirmed']===true});
 }
 output.sort((a,b)=>a.priority-b.priority||a.leadId.localeCompare(b.leadId));
 return {skills:[...MARKETING_SKILLS],observed:output.length,selected:output.slice(0,Math.max(0,Math.min(limit,5))),requiresSalesExecution:true,sendingPerformed:false,customerInterestInferred:false};
}

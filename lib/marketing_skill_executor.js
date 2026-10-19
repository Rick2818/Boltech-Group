// Marketing skill executors: inspect CRM and provider-backed evidence, never invent side effects.
export function executeMarketingSkills({leads=[],campaigns=[],providerReceipts=[],siteEvents=[]}={}){
  const rows=(Array.isArray(leads)?leads:[]).filter(x=>x?.id&&x.fields?.['Data Quality']!=='QA'&&!x.fields?.Unsubscribed&&!x.fields?.['Do Not Contact']&&!/synthetic|sint[eé]tico|bounced|unsubscribe|disqualified/i.test([x.fields?.Name,x.fields?.Status,x.fields?.Notes].join(' ')));
  const value=(x,k)=>String(x.fields?.[k]||'').trim();
  const groups={},seen=new Map(),duplicates=[];
  for(const x of rows){const country=value(x,'Country')||'UNKNOWN';groups[country]=(groups[country]||0)+1;
    const key=value(x,'Contact Email').toLowerCase()||value(x,'Company URL').toLowerCase();
    if(key){if(seen.has(key))duplicates.push({recordId:x.id,duplicateOf:seen.get(key)});else seen.set(key,x.id);}}
  const confirmed=rows.filter(x=>x.fields?.['Problem Confirmed']===true);
  const replies=rows.filter(x=>/replied|meeting|proposal/i.test(value(x,'Commercial Stage')));
  const contacts=rows.filter(x=>value(x,'Contact Email')&&value(x,'Source Evidence URL'));
  const published=(Array.isArray(providerReceipts)?providerReceipts:[]).filter(x=>x?.status==='PUBLISHED'&&x?.providerId&&x?.campaignId&&/^https:\/\//.test(x?.publicUrl||''));
  const conversions=(Array.isArray(siteEvents)?siteEvents:[]).filter(x=>x?.type==='LEAD_CONVERSION'&&x?.campaignId&&x?.evidenceRef);
  const task=(skill,state,evidence,nextAction)=>({skill,state,evidence,nextAction});
  const skills=[
    task('CRM_SEGMENTATION','EXECUTED',{records:rows.length,countries:groups},'Use real segment counts.'),
    task('BUYER_NEED_HYPOTHESES','EXECUTED',{verifiedNeedRecordIds:confirmed.map(x=>x.id),unverified:rows.length-confirmed.length},'Validate buyer needs against external evidence.'),
    task('MESSAGE_PERSONALIZATION',contacts.length?'READY_FOR_REVIEW':'BLOCKED',{contactRecordIds:contacts.slice(0,5).map(x=>x.id)},'Sales must approve personalized outreach.'),
    task('REPLY_TRIAGE_SUPPORT','EXECUTED',{priorityRecordIds:replies.slice(0,5).map(x=>x.id)},'Reconcile incoming threads before answering.'),
    task('PROPOSAL_ENABLEMENT',confirmed.length?'READY_FOR_REVIEW':'BLOCKED',{verifiedNeedRecordIds:confirmed.slice(0,5).map(x=>x.id)},'Prepare a scoped proposal; no automatic quotation.'),
    task('DUPLICATE_SUPPRESSION','EXECUTED',{duplicates},'Exclude duplicates before outbound.'),
    task('CAMPAIGN_PERFORMANCE_REVIEW',published.length?'PARTIAL_VERIFIED':'BLOCKED',{published,attributedConversions:conversions,roiVerified:false},'Obtain provider receipts and conversion attribution.'),
    task('BLOCKER_ESCALATION','EXECUTED',{distributionPending:(Array.isArray(campaigns)?campaigns:[]).filter(x=>x.status!=='PUBLISHED').map(x=>x.id)},'Agent 4 should resolve channel/attribution blockers.')
  ];
  skills[7].evidence.blockedSkills=skills.filter(x=>x.state==='BLOCKED').map(x=>x.skill);
  return {schemaVersion:1,owner:'MARKETING',skills,executedSkills:skills.length,publishingPerformed:false,sendingPerformed:false,conversionsVerified:conversions.length,distributionCertified:published.length>0};
}

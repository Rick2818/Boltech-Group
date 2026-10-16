// Daily acquisition executor: no outreach, spending or scraping.
import {createApolloClient} from './apollo_client.js';
import {createMarketingCrmExecutor} from './marketing_crm_executor.js';
export function createDailyLeadExecutor({apollo=createApolloClient(),crm=createMarketingCrmExecutor(),clock=()=>new Date()}={}) {
 return {async run({limit=5}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>5)throw Error('DAILY_LEADS_INVALID_LIMIT');
  const startedAt=clock().toISOString(),sources={Apollo:'PENDING',Lusha:'MANUAL_IMPORT_REQUIRED',Explee:'MANUAL_IMPORT_REQUIRED',Upwork:'PLATFORM_ALERT_IMPORT_REQUIRED'};
  const blockers=[],receipts=[];let candidates=[];
  try {
   const result=await apollo.listSavedContacts({perPage:25,maxPages:2,budgetMs:15000});
   if(result.complete!==true)throw Error('APOLLO_INCOMPLETE_RESULTS');
   candidates=result.contacts.filter(c=>c.apolloContactId&&c.contactEmail&&c.company&&c.domain);
   sources.Apollo='AVAILABLE';
  }catch(error){sources.Apollo='BLOCKED';blockers.push(/^APOLLO_[A-Z_]+$/.test(error?.code||'')?error.code:'APOLLO_UNAVAILABLE');}
  let recorded=0,alreadyPresent=0;const seen=new Set();
  for(const lead of candidates) {
   if(recorded>=limit)break;
   const email=lead.contactEmail.toLowerCase();if(seen.has(email))continue;seen.add(email);
   try {
    const result=await crm.intake({company:lead.company,email,source:'Apollo',
     sourceUrl:'https://app.apollo.io/#/contacts/'+encodeURIComponent(lead.apolloContactId),
     contact:lead.name||'',country:lead.country||''});
    if(result.success!==true||!result.recordId)throw Error('DAILY_LEADS_RECEIPT_INVALID');
    receipts.push({source:'Apollo',recordId:result.recordId,state:result.created?'RESEARCH_ONLY_CREATED':'DUPLICATE_EXISTING'});
    if(result.created)recorded++;else alreadyPresent++;
   }catch(error){blockers.push(/^MARKETING_CRM_[A-Z_]+$/.test(error?.code||'')?error.code:'DAILY_LEADS_INTAKE_UNCONFIRMED');break;}
  }
  return {schemaVersion:1,startedAt,finishedAt:clock().toISOString(),
   state:recorded===limit?'TARGET_RESEARCH_CANDIDATES_RECORDED':'PARTIAL_OR_BLOCKED',
   target:limit,newResearchCandidates:recorded,existingCandidates:alreadyPresent,sources,
   blockers:[...new Set(blockers)],receipts,qualifiedLeadsCertified:0,sendingPerformed:false,saleInferred:false};
 }};
}

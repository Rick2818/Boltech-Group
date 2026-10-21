// Marketing's five deliverables. No customer success claims, automatic sends or publishing.
export const MARKETING_PLAYBOOK=Object.freeze({
 version:'2026-10-21-v1',owner:'MARKETING',salesConsumer:'AGENT_1',market:'US_B2B',
 noCaseStudies:true,publicationAuthorized:false,
 demonstrations:[
  {offer:'QuoteFlow',scenario:'Synthetic quote inquiry arrives, receives an owner and next-action record',proof:'DEMO_SYNTHETIC_NOT_CUSTOMER_RESULT'},
  {offer:'LeadFlow',scenario:'Synthetic inbound lead is classified and a follow-up task is drafted',proof:'DEMO_SYNTHETIC_NOT_CUSTOMER_RESULT'},
  {offer:'ServiceFlow',scenario:'Synthetic support inquiry is routed with human escalation',proof:'DEMO_SYNTHETIC_NOT_CUSTOMER_RESULT'}
 ],
 problemMessages:[
  {key:'QUOTE_REQUEST',audience:'manufacturers',subject:'How are incoming quote requests tracked?',pain:'Manual quote handoffs and lost ownership',solution:'Organize quote intake, ownership and next actions',cta:'Would a short conversation about your quote workflow be useful?'},
  {key:'LEAD_FOLLOWUP',audience:'service and B2B sales teams',subject:'What happens after a customer inquiry arrives?',pain:'Slow or untracked lead follow-up',solution:'Organize inquiry routing and follow-up tasks',cta:'Would you be open to comparing your current process?'},
  {key:'SERVICE_ROUTING',audience:'customer service teams',subject:'Could repetitive inquiries be easier to route?',pain:'Repetitive support triage',solution:'Route recurring inquiries with human oversight',cta:'Is this a workflow your team wants to simplify?'}
 ],
 library:{offers:['QuoteFlow','LeadFlow','ServiceFlow'],requiredPerAsset:['audience','observed_problem','demonstration','evidence_label','call_to_action'],publishOnlyAfterReview:true},
 evidence:{syntheticMustBeLabeled:true,baselineBeforeAfterRequired:true,customerROIClaimsAllowed:false,uptimeClaimsAllowed:false},
 measurement:{events:['content_prepared','content_approved','content_published_provider_confirmed','page_view','inbound_inquiry','qualified_conversation','opportunity','sale_payment_confirmed'],attributionFields:['asset_id','campaign_id','channel','source_url','occurred_at','provider_receipt_id'],neverInferSalesFromPublication:true}
});
export function marketingAssetsForSales({workflow,evidence}={}){
 const item=MARKETING_PLAYBOOK.problemMessages.find(x=>x.key===workflow);
 return {item:item||null,proofStatus:evidence?.verified===true?'VERIFIED':'UNVERIFIED',send:false,publish:false};
}

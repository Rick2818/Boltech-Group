// RSI = Recursive Self-Improvement, NOT the legacy RSI-01 agent label.
// Scope: Agent 1 V2 only. No autonomous code modifications, deployment or sends.
const allowed=new Set(['LOW_VERIFIED_LEAD_YIELD','SOURCE_UNAVAILABLE','DUPLICATE_RATE_HIGH','CRM_SYNC_DELAY','REPLY_CLASSIFICATION_REVIEW']);
const proposals={
 LOW_VERIFIED_LEAD_YIELD:{action:'REVIEW_ICP_AND_SOURCE_COVERAGE',metric:'verified_leads',verification:'HUMAN_REVIEW_AND_5_LEAD_GATE'},
 SOURCE_UNAVAILABLE:{action:'CHECK_CONNECTOR_HEALTH_AND_AUTH',metric:'source_health',verification:'CONNECTOR_READ_ONLY_QA'},
 DUPLICATE_RATE_HIGH:{action:'REVIEW_DEDUP_FILTER',metric:'duplicate_rate',verification:'DEDUPE_REGRESSION_QA'},
 CRM_SYNC_DELAY:{action:'RECONCILE_CRM_RECEIPTS',metric:'crm_pending',verification:'CRM_IDEMPOTENCY_QA'},
 REPLY_CLASSIFICATION_REVIEW:{action:'REVIEW_RESPONSE_RULES',metric:'classification_review',verification:'SYNTHETIC_REPLY_QA'}
};
export function agent1RecursiveImprovement({agent='AGENT1_V2',observations=[],priorAttempts=[]}={}){
 if(agent!=='AGENT1_V2')throw Error('RSI_AGENT_SCOPE_VIOLATION');
 const attempts=new Set(priorAttempts.map(x=>x.issueCode));
 const findings=[];
 for(const item of observations){
  const code=String(item?.issueCode||'');
  if(!allowed.has(code)||attempts.has(code))continue;
  if(!Number.isInteger(item?.count)||item.count<1)continue;
  findings.push({issueCode:code,count:item.count,...proposals[code],state:'PROPOSED_REVIEW_ONLY',requiresHumanApproval:true,
   autoModifyCode:false,autoDeploy:false,autoSend:false});
  attempts.add(code);
  if(findings.length===3)break;
 }
 return {agent:'AGENT1_V2',mode:'ADVISORY_ONLY',cycleComplete:true,proposals:findings,
   codeModified:false,deploymentChanged:false,outboundSent:false};
}

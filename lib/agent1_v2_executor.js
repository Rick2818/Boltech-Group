import {createSalesAgentV2} from './agent1_v2_core.js';
import {createAgent1RedisLedger} from './agent1_v2_redis_ledger.js';
import {classifySalesReply,nextSalesAction,quotePilot} from './agent1_v2_sales_cycle.js';
import {prospecting,coldEmail,salesEnablement} from './agent1_v2_market_skills.js';
import {createAgent1LeadSources} from './agent1_v2_lead_sources.js';
import {triageAgent1Candidates} from './agent1_v2_triage.js';

// One composition root: injected transports permit deterministic QA before production.
export function createAgent1V2({redisCommand,mailSender,clock,crm}){
 if(typeof redisCommand!=='function'||typeof mailSender?.send!=='function'||typeof crm?.recordEvent!=='function')throw Error('AGENT1_V2_DEPENDENCY_MISSING');
 const ledger=createAgent1RedisLedger(redisCommand);
 const outbound=createSalesAgentV2({ledger,sender:mailSender,clock,dailyCap:5});
 return {
  skills:{prospecting,coldEmail,salesEnablement},
  leadSources:createAgent1LeadSources,
  triage:triageAgent1Candidates,
  async prepareProspect({prospect,evidence,history}){
   const research=prospecting({prospect,evidence});
   const draft=coldEmail({prospect,research,history});
   return {research,draft,send:false};
  },
  async contact(input){
   const result=await outbound.dispatch(input);
   // Never misreport a sent email if CRM recording fails. Persisted Redis receipt is primary.
   try{await crm.recordEvent({type:'OUTBOUND_ATTEMPT_RESULT',key:result.key||null,state:result.state,messageId:result.messageId||null});}
   catch{return {...result,crmSync:'PENDING_RECONCILIATION'};}
   return {...result,crmSync:'RECORDED'};
  },
  async processReply({contactId,reply,unsubscribed=false,bounced=false}){
   if(!contactId)throw Error('CONTACT_ID_REQUIRED');
   const classification=classifySalesReply({text:reply,unsubscribed,bounced});
   const next=nextSalesAction({stage:classification.stage,reply});
   await crm.recordEvent({type:'INBOUND_CLASSIFIED',contactId,stage:classification.stage,action:classification.action,followupAction:next.action});
   return {classification,next,sent:false};
  },
  async prepareQuote({contactId,scopeAccepted=false,discountPercent=0}){
   if(!contactId)throw Error('CONTACT_ID_REQUIRED');
   const quote=quotePilot({scopeAccepted,discountPercent});
   await crm.recordEvent({type:'QUOTE_PREPARED',contactId,amount:quote.total,scopeAccepted,readyToOffer:quote.readyToOffer});
   return {...quote,sent:false};
  }
 };
}

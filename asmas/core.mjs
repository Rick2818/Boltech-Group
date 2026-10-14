// ASMAS v4.1 — pure deterministic orchestration kernel.
// No external calls, emails, or payments. Production adapters must supply durable transactions.
import { randomUUID } from 'node:crypto';
export const AGENTS = Object.freeze(['A1','A2','A3','A4','A5']);
export const ROUTE = Object.freeze(['A5','A1','A2','A3','A4']);
export const STAGES = Object.freeze(['NEW_LEAD','RESEARCHING','QUALIFIED','PROPOSAL_PREPARING','PROPOSAL_SENT','FOLLOW_UP','NEGOTIATION','ACCEPTED','PAYMENT_PENDING','PAYMENT_CONFIRMED','CLOSED_WON','DISQUALIFIED','CLOSED_LOST','CANCELLED']);
const transitions = {
 NEW_LEAD:['RESEARCHING','DISQUALIFIED'],RESEARCHING:['QUALIFIED','DISQUALIFIED'],
 QUALIFIED:['PROPOSAL_PREPARING','DISQUALIFIED'],
 PROPOSAL_PREPARING:['PROPOSAL_SENT'],PROPOSAL_SENT:['FOLLOW_UP','NEGOTIATION'],
 FOLLOW_UP:['NEGOTIATION','CLOSED_LOST'],NEGOTIATION:['ACCEPTED','CLOSED_LOST'],
 ACCEPTED:['PAYMENT_PENDING'],PAYMENT_PENDING:['PAYMENT_CONFIRMED','CANCELLED'],
 PAYMENT_CONFIRMED:['CLOSED_WON'], CLOSED_WON:[], DISQUALIFIED:[], CLOSED_LOST:[], CANCELLED:[]
};
export function message({source,destination,action,caseId,runId,taskId=randomUUID(),id=randomUUID(),hops=0,payload={}}){
 if(!AGENTS.includes(source)||!AGENTS.includes(destination)||source===destination) throw Error('INVALID_AGENT_ROUTE');
 if(hops>10) throw Error('A2A_HOP_LIMIT');
 if(!caseId||!runId||!action) throw Error('MESSAGE_FIELDS_REQUIRED');
 return Object.freeze({schema_version:1,message_id:id,task_id:taskId,correlation_id:runId,causation_id:null,source_agent:source,destination_agent:destination,action,case_id:caseId,run_id:runId,hops,created_at:new Date().toISOString(),idempotency_key:runId+':'+taskId+':'+action,payload});
}
export class CaseLedger {
 constructor({caseId='SYN-E2E-001',synthetic=true}={}){this.caseId=caseId;this.synthetic=synthetic;this.stage='NEW_LEAD';this.version=0;this.events=[];this.processed=new Set();this.deliveries=[];}
 transit(to,{key,agent,evidence}={}){
  if(!AGENTS.includes(agent)) throw Error('INVALID_AGENT');
  if(!key) throw Error('MISSING_IDEMPOTENCY_KEY');
  if(this.processed.has(key)) return false;
  if(!transitions[this.stage]?.includes(to)) throw Error('INVALID_STAGE_TRANSITION:'+this.stage+'->'+to);
  if(to==='PAYMENT_CONFIRMED'&&!this.synthetic&&!evidence?.providerVerified) throw Error('PAYMENT_EVIDENCE_REQUIRED');
  const from=this.stage;this.stage=to;this.version++;this.processed.add(key);
  this.events.push({kind:'STAGE',from,to,key,agent,version:this.version,is_synthetic:this.synthetic});return true;
 }
 deliver(msg){
  if(msg.case_id!==this.caseId)throw Error('CASE_MISMATCH');
  if(this.processed.has(msg.idempotency_key))return false;
  this.processed.add(msg.idempotency_key);this.deliveries.push(msg);this.events.push({kind:'HANDOFF',from:msg.source_agent,to:msg.destination_agent,id:msg.message_id,is_synthetic:this.synthetic});return true;
 }
 report(){return {case_id:this.caseId,is_synthetic:this.synthetic,stage:this.stage,version:this.version,events:this.events,deliveries:this.deliveries.length,revenue_real:0};}
}

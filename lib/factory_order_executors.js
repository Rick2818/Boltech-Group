// Two logical executors, using the existing durable order ledger and its CAS/idempotency.
// No new cron, databases, model subscriptions, payment methods, or sending capability.
import {createClientOrderExecution} from './client_order_execution.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_.:-]{1,120}$/.test(id);
export function createFactoryOrderExecutors({ledger=createClientOrderExecution()}={}){
  // Executor 1: the sales Dot/Agent 1 transfers an existing explicitly accepted opportunity.
  async function salesToFactory({opportunityId}={}){
    if(!valid(opportunityId))fail('FACTORY_INVALID_OPPORTUNITY');
    const r=await ledger.fromOpportunity(opportunityId);
    if(r.opportunityId!==opportunityId||r.execution!=='WAITING_IMPLEMENTATION'||r.delivery!=='NOT_DELIVERED'||!r.acceptanceMessageId||!r.approval && !r.quoteReference)fail('FACTORY_SALES_HANDOFF_UNVERIFIED');
    return {orderId:r.orderId,owner:'FACTORY',state:'WAITING_IMPLEMENTATION',receipt:'ACCEPTED_ORDER_REGISTERED',customerDelivery:false};
  }
  // Executor 2: approved build -> independent QA evidence -> verified paid order -> verified delivery receipt.
  // Each step requires ledger version, a unique event ID and real evidence validated by the existing ledger.
  async function factoryToCustomer(input={}){
    if(!valid(input.orderId)||!valid(input.eventId))fail('FACTORY_EVENT_REQUIRED');
    const allowed=['approve-plan','qa','factory-ready','payment','deliver'];
    if(!allowed.includes(input.operation))fail('FACTORY_OPERATION_NOT_ALLOWED');
    const before=await ledger.read(input.orderId);
    if(!before)fail('FACTORY_ORDER_NOT_FOUND');
    if(input.operation==='factory-ready' && (before.execution!=='QA_PASSED' || before.delivery!=='NOT_DELIVERED' || !valid(input.evidenceRef)))fail('FACTORY_READINESS_EVIDENCE_REQUIRED');
    if(input.operation==='deliver'&&(before.execution!=='QA_PASSED'||before.payment!=='PAID'))fail('FACTORY_DELIVERY_BLOCKED');
    const updated=await ledger.act({...input,expectedVersion:before.version});
    return {orderId:updated.orderId,operation:input.operation,version:updated.version,execution:updated.execution,payment:updated.payment,delivery:updated.delivery,customerDelivery:updated.delivery==='DELIVERED',receipt:updated.events?.at(-1)?.eventId||input.eventId};
  }
  return {salesToFactory,factoryToCustomer};
}

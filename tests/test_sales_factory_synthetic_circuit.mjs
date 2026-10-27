import test from 'node:test';import assert from 'node:assert/strict';
import {salesReply} from '../lib/sales_dot_pilot.js';
import {createFactoryOrderExecutors} from '../lib/factory_order_executors.js';
// This is an isolated synthetic contract test. Production payment/provider is not bypassed.
test('synthetic Boltech client: Leo intake -> accepted order -> factory -> QA -> delivery',async()=>{
 let chat={step:0,answers:[]};
 for(const a of ['Atender leads','web y CRM','100 al mes','Automatizar seguimiento','cliente@example.test'])chat=salesReply(a,chat,'es');
 assert.equal(chat.complete,true);
 const order={orderId:'syn-boltech-001',opportunityId:'syn-op-001',acceptanceMessageId:'syn-accept',quoteReference:'syn-q-001',execution:'WAITING_IMPLEMENTATION',payment:'UNVERIFIED',delivery:'NOT_DELIVERED',version:1,events:[]};
 const ledger={
 fromOpportunity:async()=>structuredClone(order),
 read:async()=>structuredClone(order),
 act:async input=>{
 assert.equal(input.expectedVersion,order.version);order.version++;
 if(input.operation==='approve-plan')order.execution='READY_FOR_BUILD_AND_QA';
 if(input.operation==='qa')order.execution='QA_PASSED';
 if(input.operation==='payment'){assert.equal(input.syntheticProviderVerified,true);order.payment='PAID';}
 if(input.operation==='deliver'){assert.equal(input.syntheticDeliveryReceipt,true);order.delivery='DELIVERED';}
 order.events.push({eventId:input.eventId});return structuredClone(order);
 }};
 const {salesToFactory,factoryToCustomer}=createFactoryOrderExecutors({ledger});
 const handoff=await salesToFactory({opportunityId:order.opportunityId});
 assert.equal(handoff.receipt,'ACCEPTED_ORDER_REGISTERED');
 for(const [i,item] of [{operation:'approve-plan'},{operation:'qa'},{operation:'payment',syntheticProviderVerified:true},{operation:'deliver',syntheticDeliveryReceipt:true}].entries())
 await factoryToCustomer({orderId:order.orderId,eventId:'syn-'+i,...item});
 assert.equal(order.delivery,'DELIVERED');assert.equal(order.payment,'PAID');assert.equal(chat.summary.factoryStatus,'NOT_ORDERED');
});
test('never convert unaccepted sales chat into paid factory order',()=>{
 let chat=salesReply('Necesito ventas',{step:0,answers:[]},'es');
 assert.equal(chat.complete,false);assert.equal(chat.summary,undefined);
});

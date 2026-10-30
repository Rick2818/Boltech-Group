import test from 'node:test';
import assert from 'node:assert/strict';
import {createFactoryOrderExecutors} from '../lib/factory_order_executors.js';
function harness(){
 const state={orderId:'order-test',opportunityId:'op-test',execution:'WAITING_IMPLEMENTATION',delivery:'NOT_DELIVERED',payment:'UNVERIFIED',acceptanceMessageId:'accept-test',quoteReference:'quote-test',version:1,events:[]};
 const ledger={
 async fromOpportunity(id){assert.equal(id,'op-test');return structuredClone(state)},
 async read(){return structuredClone(state)},
 async act(input){
   assert.equal(input.expectedVersion,state.version);
   if(input.operation==='approve-plan'){state.execution='READY_FOR_BUILD_AND_QA';}
   if(input.operation==='qa'){if(state.execution!=='READY_FOR_BUILD_AND_QA')throw Error('QA_WITHOUT_PLAN');state.execution='QA_PASSED';}
   if(input.operation==='factory-ready'){if(state.execution!=='QA_PASSED'||input.evidenceRef!=='verified-receipt')throw Error('READINESS_NOT_VERIFIED');state.factoryReadiness={evidenceRef:input.evidenceRef};}
   if(input.operation==='payment'){if(!input.verifiedPayment)throw Error('PAYMENT_NOT_VERIFIED');state.payment='PAID';}
   if(input.operation==='deliver'){if(!state.factoryReadiness)throw Error('FACTORY_NOT_READY');if(!input.verifiedReceipt)throw Error('DELIVERY_RECEIPT_MISSING');state.delivery='DELIVERED';}
   state.version++;state.events.push({eventId:input.eventId});return structuredClone(state);
 }
 };
 return {executors:createFactoryOrderExecutors({ledger}),state};
}
test('synthetic customer: sales handoff then factory QA/payment/delivery',async()=>{
 const {executors}=harness();let r=await executors.salesToFactory({opportunityId:'op-test'});assert.equal(r.customerDelivery,false);
 const steps=[{operation:'approve-plan'},{operation:'qa'},{operation:'factory-ready',evidenceRef:'verified-receipt'},{operation:'payment',verifiedPayment:true},{operation:'deliver',verifiedReceipt:true}];
 for(const [i,step] of steps.entries())r=await executors.factoryToCustomer({orderId:'order-test',eventId:'test-'+i,...step});
 assert.equal(r.customerDelivery,true);assert.equal(r.delivery,'DELIVERED');
});
test('synthetic negative: delivery before QA/payment prohibited',async()=>{
 const {executors}=harness();
 await assert.rejects(executors.factoryToCustomer({orderId:'order-test',eventId:'early',operation:'deliver'}),{code:'FACTORY_DELIVERY_BLOCKED'});
});
test('synthetic negative: payment missing receipt cannot advance',async()=>{
 const {executors}=harness();
 await assert.rejects(executors.factoryToCustomer({orderId:'order-test',eventId:'unverified',operation:'payment'}),/PAYMENT_NOT_VERIFIED/);
});
test('synthetic negative: unsupported actions rejected',async()=>{
 const {executors}=harness();
 await assert.rejects(executors.factoryToCustomer({orderId:'order-test',eventId:'x',operation:'send-email'}),{code:'FACTORY_OPERATION_NOT_ALLOWED'});
});

test('synthetic factory-ready routes evidence to ledger without marking delivered',async()=>{
 const {executors,state}=harness();
 await executors.factoryToCustomer({orderId:'order-test',eventId:'plan',operation:'approve-plan'});
 await executors.factoryToCustomer({orderId:'order-test',eventId:'qa',operation:'qa'});
 await assert.rejects(executors.factoryToCustomer({orderId:'order-test',eventId:'bad',operation:'factory-ready',evidenceRef:'forged'}),/READINESS_NOT_VERIFIED/);
 await assert.rejects(executors.factoryToCustomer({orderId:'order-test',eventId:'missing',operation:'factory-ready'}),{code:'FACTORY_READINESS_EVIDENCE_REQUIRED'});
 const r=await executors.factoryToCustomer({orderId:'order-test',eventId:'real',operation:'factory-ready',evidenceRef:'verified-receipt'});
 assert.equal(r.customerDelivery,false);
 assert.equal(state.factoryReadiness.evidenceRef,'verified-receipt');
});

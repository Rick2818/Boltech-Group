import test from 'node:test';
import assert from 'node:assert/strict';
import {pilotCommercialTerms,commercialOfferContext} from '../lib/commercial_offer.js';
import {createAgent1SalesExecutor} from '../lib/agent1_sales_skills.js';

test('approved pilot splits the discounted total, not the original price',()=>{
 const full=pilotCommercialTerms();
 assert.deepEqual([full.baseAmount,full.totalAmount,full.upfrontAmount,full.completionAmount],[990,990,495,495]);
 const discounted=createAgent1SalesExecutor().commercialTerms({discountPercent:10});
 assert.deepEqual([discounted.totalAmount,discounted.upfrontAmount,discounted.completionAmount],[891,445.5,445.5]);
 assert.equal(discounted.upfrontAmount+discounted.completionAmount,discounted.totalAmount);
 assert.equal(discounted.paymentConfirmed,false);assert.equal(discounted.createsOrder,false);
});
test('invalid or excessive discounts cannot become quotes',()=>{
 for(const discountPercent of [-1,10.01,100,NaN,Infinity,'10',null]){
  assert.throws(()=>pilotCommercialTerms({discountPercent}),{code:'COMMERCIAL_DISCOUNT_NOT_AUTHORIZED'});
 }
});
test('agent 1 consumes policy and keeps pilot scope separate from other quotes',()=>{
 const plan=createAgent1SalesExecutor().planSearch();
 assert.equal(plan.commercialTerms.maxDiscountPercent,10);
 assert.equal(plan.commercialTerms.recurringAmount,null);
 assert.equal(plan.commercialTerms.monthlyInstallmentsAllowed,false);
 assert.match(plan.commercialTerms.monthlyPaymentRule,/paid in full/);
 assert.equal(plan.commercialTerms.recurringPricingStatus,'NOT_OFFERED');
 assert.deepEqual(plan.commercialTerms.scope,{businesses:1,webWorkflows:1,simpleIntegrations:1});
 assert.match(plan.commercialTerms.applicability,/Only the USD990 pilot/);
 assert.equal(plan.commercialTerms.otherOffersPricingEnabled,false);
 assert.match(plan.commercialTerms.deliveryStartsAfter,/upfront payment confirmed/);
 assert.equal(plan.commercialTerms.existingAcceptedQuotesUnchanged,true);
 const again=pilotCommercialTerms();again.scope.businesses=999;again.exclusions.push('corrupt');
 assert.equal(pilotCommercialTerms().scope.businesses,1);
 assert.ok(!pilotCommercialTerms().exclusions.includes('corrupt'));
 assert.match(commercialOfferContext(),/50% antes de comenzar y 50% al terminar/);
});

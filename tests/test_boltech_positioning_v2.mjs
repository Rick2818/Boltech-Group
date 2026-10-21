import test from 'node:test';import assert from 'node:assert/strict';
import {BOLTECH_POSITIONING} from '../lib/boltech_positioning_v2.js';
import {managedOperationsSalesBrief} from '../lib/agent1_v2_market_skills.js';
import {managedOperationsMarketingBrief} from '../lib/marketing_autonomy.js';
test('positioning shared by exactly two agents',()=>{assert.equal(BOLTECH_POSITIONING.agents.length,2);assert.equal(BOLTECH_POSITIONING.implementationPriceUsd,990);assert.deepEqual(BOLTECH_POSITIONING.paymentMilestones,[50,50]);});
test('sales does not invent SLA or managed subscription',()=>{const x=managedOperationsSalesBrief();assert.equal(x.send,false);assert.equal(x.commercialTerms.recurringService,'Separate quotation required');assert.deepEqual(x.verifiedClaims,[]);});
test('marketing requires evidence before public claims',()=>{const x=managedOperationsMarketingBrief();assert.equal(x.publishReady,false);assert.equal(x.execute,false);assert.equal(x.proofRequired,true);});

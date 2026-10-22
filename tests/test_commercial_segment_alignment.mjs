import test from 'node:test';
import assert from 'node:assert/strict';
import pilot from '../config/commercial_pilot.json' with {type:'json'};
import {BOLTECH_POSITIONING,positioningForSales} from '../lib/boltech_positioning_v2.js';
import {MARKETING_PLAYBOOK} from '../lib/marketing_commercial_playbook.js';
import {pilotCommercialTerms} from '../lib/commercial_offer.js';

test('sales, marketing and pilot agree on initial US manufacturing segment',()=>{
 assert.match(pilot.targetSegment,/fabricaci[oó]n met[aá]lica/i);
 assert.match(pilot.targetSegment,/Estados Unidos/i);
 assert.equal(BOLTECH_POSITIONING.primaryMarket,'US_B2B');
 assert.match(BOLTECH_POSITIONING.primarySegment,/manufacturing/i);
 assert.equal(MARKETING_PLAYBOOK.primarySegment,'US_MANUFACTURING_METAL_FABRICATION');
 assert.match(MARKETING_PLAYBOOK.problemMessages[0].audience,/fabrication/i);
 assert.match(positioningForSales().audience,/manufacturing/i);
 assert.equal(BOLTECH_POSITIONING.otherIndustriesEligible,true);
 assert.equal(MARKETING_PLAYBOOK.otherIndustriesEligible,true);
});
test('segmentation revision cannot change price, split, scope or payments',()=>{
 const t=pilotCommercialTerms();
 assert.equal(pilot.implementationAmount,990);
 assert.equal(t.baseAmount,990);
 assert.equal(t.upfrontAmount,495);
 assert.equal(t.completionAmount,495);
 assert.equal(pilot.scope.businesses,1);
 assert.equal(pilot.scope.webWorkflows,1);
 assert.equal(pilot.scope.simpleIntegrations,1);
 assert.equal(pilot.paymentEnabled,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pilot from '../config/commercial_pilot.json' with {type:'json'};
import {pilotCommercialTerms} from '../lib/commercial_offer.js';
import {BOLTECH_POSITIONING} from '../lib/boltech_positioning_v2.js';

test('commercial page matches authorized pilot and general agent prices',()=>{
 const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(page,/US\$600/);
 assert.match(page,/US\$900/);
 assert.match(page,/US\$300 iniciales \+ US\$300/);
 assert.doesNotMatch(page,/US\$990|US\$495/);
 assert.equal(pilot.implementationAmount,600);
 assert.equal(pilot.generalAgentImplementationAmount,900);
 assert.equal(BOLTECH_POSITIONING.implementationPriceUsd,600);
 assert.equal(BOLTECH_POSITIONING.generalAgentImplementationPriceUsd,900);
 const terms=pilotCommercialTerms();
 assert.deepEqual([terms.totalAmount,terms.upfrontAmount,terms.completionAmount],[600,300,300]);
});

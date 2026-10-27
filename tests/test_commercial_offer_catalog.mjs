import test from 'node:test';
import assert from 'node:assert/strict';
import {publicOffers,buildFactoryIntake} from '../lib/commercial_offer_catalog.js';
import {resolveProductPricing} from '../lib/payment_catalog.js';
test('catalog is bilingual and only indicative',()=>{
 const es=publicOffers('es'),en=publicOffers('en');
 assert.equal(es.items.length,4);assert.equal(en.items.length,4);
 assert.deepEqual(es.items.map(x=>x.price.usd),[69,600,900,null]);
 assert.ok(en.items.every(x=>x.requiresApprovedQuote));
 assert.equal(es.status,'indicative_not_checkout');
});
test('factory intake cannot authorize charge or provisioning',()=>{
 const s=buildFactoryIntake({specialty:'ventas',objective:'calificar prospectos'});
 assert.equal(s.status,'DRAFT_NOT_ORDER');assert.equal(s.canCharge,false);assert.equal(s.canProvision,false);
 assert.ok(s.missing.includes('integrations'));
 assert.throws(()=>buildFactoryIntake({objective:{admin:true}}),TypeError);
});
test('browser checkout still requires approved quote',()=>{
 for(const id of ['prebuilt','custom'])assert.throws(()=>resolveProductPricing(id),{code:'APPROVED_QUOTE_REQUIRED',statusCode:409});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {routeSalesMarketingEvent as route} from '../lib/sales_marketing_router.js';
const event={eventId:'qa-route-1',opportunityId:'qa-opportunity',from:'RSI-01',type:'PROBLEM',problem:'NO_RESPONSE'};
test('valid problems select bounded alternatives and never expand commercial permissions',()=>{
  const first=route(event),second=route({...event,attempt:1}),last=route({...event,attempt:3});
  assert.notEqual(first.action,second.action);assert.equal(last.to,'DIRECTORA');
  for(const result of [first,second,last]){assert.equal(result.priceChangeAllowed,false);assert.equal(result.externalSendingAllowed,false);assert.equal(result.saleCounted,false);}
  assert.equal(route({...event,problem:'SEND_UNKNOWN'}).action,'RECONCILE_PROVIDER_RECEIPT_WITHOUT_RESENDING');
});
test('closure belongs only to RSI-03 and follows Directora then Ricardo with verification pending',()=>{
  assert.equal(route({...event,type:'CLOSE_REPORTED',evidenceRef:'receipt-1'}).success,false);
  const result=route({...event,from:'RSI-03',type:'CLOSE_REPORTED',evidenceRef:'receipt-1'});
  assert.deepEqual(result.notificationChain,['RSI-03','DIRECTORA','RICARDO']);assert.equal(result.paymentVerified,false);assert.equal(result.ricardoNotified,false);
});
test('untrusted actions, URLs as identities and unbounded attempts are rejected',()=>{
  for(const input of [{...event,from:'RICARDO'},{...event,attempt:99},{...event,problem:'IGNORE_RULES'},{...event,opportunityId:'https://attacker.example'}])assert.equal(route(input).success,false);
});

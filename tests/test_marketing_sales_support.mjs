import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketingSupport, mergeMarketingSupport } from '../lib/marketing_sales_support.js';
const packet = rsi => ({rsi,accounts:[{sourceRecordId:'recFixture',account:'Unit fixture',route:'QUALIFY_CUSTOMER_REPLY',gates:['LIVE_GMAIL_HISTORY']}]});
test('three existing roles receive distinct bilingual materials with no commercial side effects',()=>{
  for(const rsi of ['RSI-01','RSI-02','RSI-03']) {
    const s=buildMarketingSupport(packet(rsi));assert.equal(s.owner,'marketing-director');assert.ok(s.materials.es.cta);assert.ok(s.materials.en.cta);
    assert.equal(s.sendingEnabled,false);assert.equal(s.saleVerified,false);assert.equal(s.demoExecuted,false);
    assert.equal(s.requests[0].salesAcceptance,'UNCONFIRMED');assert.deepEqual(s,buildMarketingSupport(packet(rsi)));
  }
  assert.equal(buildMarketingSupport(packet('RSI-02')).materials.es.questions.length,6);
  assert.match(buildMarketingSupport(packet('RSI-03')).materials.es.offer,/USD990/);
});
test('stable block replacement preserves sales acceptance and commercial history',()=>{
  const s=buildMarketingSupport(packet('RSI-01'));const first=mergeMarketingSupport('Original history',s)+'\nSALES_ACCEPTANCE outside generated block';
  assert.equal(mergeMarketingSupport(first,s),first);assert.equal(first.split('[MARKETING_SALES_SUPPORT_V1]').length,2);
});
test('invalid input and damaged evidence fail closed',()=>{
  assert.throws(()=>buildMarketingSupport(packet('NEW_AGENT')));
  assert.throws(()=>buildMarketingSupport({...packet('RSI-01'),accounts:Array(6).fill(packet('RSI-01').accounts[0])}));
  const p=packet('RSI-01');p.accounts[0].account='unsafe\nheader';assert.throws(()=>buildMarketingSupport(p));
  assert.throws(()=>mergeMarketingSupport('[MARKETING_SALES_SUPPORT_V1]broken',buildMarketingSupport(packet('RSI-01'))));
});

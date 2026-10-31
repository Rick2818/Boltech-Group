import test from 'node:test';
import assert from 'node:assert/strict';
import {B2B_TOPICS,assessB2BContent,selectB2BTopic,decideMarketingRSI} from '../lib/marketing_b2b_strategy.js';
test('rejects legacy shallow material',()=>{
 const result=assessB2BContent({subject:'How are quotes tracked?',body:'Would a short conversation be useful?',topic:'QUOTE_REQUEST'});
 assert.equal(result.approved,false);
 assert.ok(result.issues.includes('INSUFFICIENT_DEPTH'));
 assert.ok(result.issues.includes('TOPIC_INVALID'));
});
test('topic selection diversifies away from recent repetition',()=>{
 assert.equal(selectB2BTopic({history:Array(12).fill('MANUFACTURING_RFQ')}),'INDUSTRIAL_OPERATIONS');
 assert.equal(B2B_TOPICS.length>=10,true);
});
test('RSI fails closed without evidence and reverts regression',()=>{
 assert.equal(decideMarketingRSI({}).decision,'HOLD');
 assert.equal(decideMarketingRSI({baseline:{samples:10,qualifiedLeads:3,cost:1},candidate:{samples:10,qualifiedLeads:1,cost:1}}).decision,'REVERT');
});
test('RSI adopts improvement only with measured qualified leads and bounded cost',()=>{
 assert.equal(decideMarketingRSI({baseline:{samples:10,qualifiedLeads:1,cost:2},candidate:{samples:10,qualifiedLeads:3,cost:2}}).decision,'ADOPT');
});

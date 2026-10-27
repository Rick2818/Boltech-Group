import test from 'node:test';import assert from 'node:assert/strict';import {salesReply} from '../lib/sales_dot_pilot.js';
test('synthetic Boltech customer completes five sales questions, no payment or dispatch',()=>{
 let s={step:0,answers:[]};for(const v of ['Necesitamos ventas','CRM','150 leads/mes','Responder en 1 hora','cliente@example.test'])s=salesReply(v,s,'es');
 assert.equal(s.complete,true);assert.equal(s.summary.commercialOwner,'AGENT_1');assert.equal(s.summary.quoteStatus,'PENDING_APPROVAL');assert.equal(s.summary.factoryStatus,'NOT_ORDERED');
});
test('invalid email blocks completion',()=>{let s={step:4,answers:['x','y','z','w']};s=salesReply('not-email',s);assert.equal(s.complete,false);assert.equal(s.step,4)});
test('English conversation does not claim real sale',()=>{const s=salesReply('Need assistance',{step:0,answers:[]},'en');assert.match(s.reply,/tools/);assert.equal(s.complete,false)});

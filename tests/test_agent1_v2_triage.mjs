import test from 'node:test';
import assert from 'node:assert/strict';
import {triageAgent1Candidates} from '../lib/agent1_v2_triage.js';
import {createAgent1V2} from '../lib/agent1_v2_executor.js';
test('US automation signal remains review only',()=>{
 const r=triageAgent1Candidates([{source:'UPWORK',candidates:[{sourceId:'1',country:'United States',title:'Automate support workflow'}]}]);
 assert.equal(r.selected.length,0);
 assert.equal(r.ready,false);
 assert.equal(r.status,'INCOMPLETE');
 assert.equal(r.sent,0);
 assert.equal(r.qualifiedForOutbound,0);
});
test('reject non-US, unsafe and unrelated requests',()=>{
 const r=triageAgent1Candidates([{source:'UPWORK',candidates:[
 {country:'Pakistan',title:'CRM automation'},
 {country:'US',title:'Captcha bypass automation'},
 {country:'USA',title:'Illustrate a book'}]}]);
 assert.equal(r.selected.length,0);
});
test('same triage reachable through unified executor',()=>{
 const a=createAgent1V2({redisCommand:async()=>null,mailSender:{send:async()=>{throw Error('NOT_ALLOWED');}},crm:{recordEvent:async()=>{}}});
 assert.equal(a.triage([],{}).remaining,null);
});

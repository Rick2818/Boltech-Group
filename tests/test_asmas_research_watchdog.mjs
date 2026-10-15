import test from 'node:test';import assert from 'node:assert/strict';import {researchDecision,advanceResearchQueue} from '../lib/asmas_research_watchdog.js';
const now=Date.parse('2026-10-16T00:00:00Z'),old='2026-10-14T00:00:00Z';
test('not due stays unchanged',()=>assert.equal(researchDecision({Status:'BLOCKED_FIT_RESEARCH','Updated At':'2026-10-15T20:00:00Z'},now),null));
test('first overdue advances',()=>assert.equal(researchDecision({Status:'BLOCKED_FIT_RESEARCH','Updated At':old},now).status,'RESEARCH_RETRY_1'));
test('second overdue advances',()=>assert.equal(researchDecision({Status:'RESEARCH_RETRY_1','Updated At':old},now).status,'RESEARCH_RETRY_2'));
test('third overdue escalates',()=>assert.equal(researchDecision({Status:'RESEARCH_RETRY_2','Updated At':old},now).status,'DIRECTOR_REVIEW_REQUIRED'));
test('missing timestamp escalates',()=>assert.equal(researchDecision({Status:'BLOCKED_FIT_RESEARCH'},now).status,'DIRECTOR_REVIEW_REQUIRED'));
test('no sends or payments; persistent update receipt',async()=>{const work=[{id:'r1',fields:{RSI:'RSI-01',Status:'RESEARCH_RETRY_2','Updated At':old,Evidence:'x'}}];const received=[];const updates=await advanceResearchQueue({work,now:()=>new Date(now).toISOString(),request:async(table,args)=>{received.push(args);return {records:[{id:'r1'}]}}});assert.equal(updates[0].status,'DIRECTOR_REVIEW_REQUIRED');assert.equal(received[0].body.records[0].fields.Status,'DIRECTOR_REVIEW_REQUIRED')});

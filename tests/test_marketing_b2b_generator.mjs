import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketingB2BGenerator} from '../lib/marketing_b2b_generator.js';
test('adapter passes bounded research to Gemini and parses JSON',async()=>{
 let args;
 const generator=createMarketingB2BGenerator({generate:async x=>{args=x;return {text:JSON.stringify({
 subject:'Manufacturing RFQ',body:'Detailed analysis '.repeat(40),industry:'Manufacturing',
 buyerRole:'COO',businessProblem:'Manual handoffs',proposedSolution:'Workflow integration',
 kpis:['Response time'],language:'en'})}}});
 const item=await generator({topic:'MANUFACTURING_RFQ',sources:[{title:'Report',url:'https://example.org',observedAt:'2026-10-31'}]});
 assert.equal(item.language,'en');assert.equal(args.modelName,'gemini-2.5-flash');
});
test('rejects malformed model output',async()=>{
 const generator=createMarketingB2BGenerator({generate:async()=>({text:'not JSON'})});
 await assert.rejects(()=>generator({topic:'API_WORKFLOWS',sources:[{url:'https://example.org'}]}),/INVALID_JSON/);
});

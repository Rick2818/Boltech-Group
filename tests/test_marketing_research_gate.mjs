import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMarketingResearch} from '../lib/marketing_research_gate.js';

test('rejects non-allowlisted and local URLs without fetching', async () => {
 let calls=0;
 const result=await verifyMarketingResearch({
  candidates:[{url:'https://localhost/internal',title:'Local'},{url:'https://unapproved.example/report',title:'Other'}],
  allowedHosts:['approved.example'],
  fetcher:async()=>{calls++;throw Error('unexpected fetch')}
 });
 assert.equal(calls,0);
 assert.deepEqual(result,[]);
});
test('accepts an allowed readable source and records observation',async()=>{
 const result=await verifyMarketingResearch({
  candidates:[{url:'https://approved.example/report',title:'Industry report'}],
  allowedHosts:['approved.example'],
  fetcher:async()=>({ok:true,status:200,headers:{get:()=> 'text/plain'},text:async()=> 'Research evidence '.repeat(25)})
 });
 assert.equal(result.length,1);
 assert.equal(result[0].httpStatus,200);
 assert.ok(result[0].excerpt.includes('Research evidence'));
});
test('fails closed without explicit allowed hosts',async()=>{
 await assert.rejects(()=>verifyMarketingResearch({candidates:[]}),/ALLOWLIST_REQUIRED/);
});

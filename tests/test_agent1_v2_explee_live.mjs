import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpleeLiveSource} from '../lib/agent1_v2_explee_live.js';
import {createAgent1LeadSources} from '../lib/agent1_v2_lead_sources.js';
test('Explee refuses missing credentials or insecure endpoint',()=>{
 assert.throws(()=>createExpleeLiveSource({baseUrl:'https://api.explee.com/v1/'}),/EXPLEE_API_KEY_REQUIRED/);
 assert.throws(()=>createExpleeLiveSource({baseUrl:'http://api.explee.com/v1/',apiKey:'test'}),/EXPLEE_API_ENDPOINT_UNVERIFIED/);
});
test('Explee authenticated adapter reads, does not verify contacts or send',async()=>{
 let calls=0;
 const reader=createExpleeLiveSource({apiKey:'test-secret',baseUrl:'https://api.explee.com/v1/',fetcher:async(url,opts)=>{calls++;assert.equal(opts.method,'POST');assert.match(opts.headers.Authorization,/Bearer /);return {ok:true,json:async()=>({companies:[{name:'QA Company',country:'US',email:'contact@example.com'}]})};}});
 const result=await createAgent1LeadSources({explee:reader}).discover();
 assert.equal(calls,1);assert.equal(result.sources[2].status,'OBSERVED');assert.equal(result.sources[2].candidates[0].country,'US');assert.equal(result.sources[2].candidates[0].contactVerified,false);assert.equal(result.sendAllowed,false);
});
test('Explee failed API never silently substitutes historic contacts',async()=>{
 const reader=createExpleeLiveSource({apiKey:'test-secret',baseUrl:'https://api.explee.com/v1/',fetcher:async()=>({ok:false,status:401})});
 const result=await createAgent1LeadSources({explee:reader}).discover();
 assert.equal(result.sources[2].status,'CONNECTOR_UNAVAILABLE');assert.equal(result.sources[2].candidates.length,0);
});

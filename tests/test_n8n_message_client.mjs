import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runN8nMessage} from '../lib/n8n_message_client.js';
const event={eventId:'fixture-message',opportunityId:'rec0123456789abcd',from:'RSI-01',type:'SUPPORT_REQUEST',problem:'SUPPORT_NEEDED'};
const runtime={key:'fixture-frontdoor',roleKeys:{'RSI-01':'fixture-role'}};
const receipt={...event,success:true,createdAt:'2026-10-07T20:00:00Z',fingerprint:'server-fixture'};
function fixture(status){let record=status?{fingerprint:createHash('sha256').update(JSON.stringify(event)).digest('hex'),status}:null;const urls=[];
 const store={read:async()=>record,save:async value=>{record={...value};},reserve:async value=>{if(record)throw Object.assign(Error('EXISTS'),{code:'EEXIST'});record={...value};}};
 return {store,urls,read:()=>record,fetcher:async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('localhost')||url.includes('127.0.0.1')?receipt:{success:true,receipt}};}};
}
test('all unconfirmed existing states exit nonzero without contacting or resending',async()=>{for(const status of ['PENDING','UNKNOWN','REJECTED','RECEIVED']){const f=fixture(status);const r=await runN8nMessage({event,runtime,...f});assert.equal(r.exitCode,1);assert.equal(f.urls.length,0);}});
test('timeout persists UNKNOWN; repeating never resends; reconciliation persists actual cloud receipt',async()=>{const f=fixture();let sends=0;await runN8nMessage({event,runtime,store:f.store,fetcher:async()=>{sends++;throw Error('TIMEOUT');}});assert.equal(f.read().status,'UNKNOWN');assert.equal((await runN8nMessage({event,runtime,...f})).exitCode,1);assert.equal(sends,1);assert.equal(f.urls.length,0);assert.equal((await runN8nMessage({event,runtime,...f,reconcile:true})).exitCode,0);assert.equal(f.read().reconciliationCode,'CLOUD_RECEIPT_VERIFIED');assert.ok(f.urls.every(url=>url.startsWith('https://')));});
test('wrong, missing or unavailable receipt remains nonzero',async()=>{for(const response of [{success:true,receipt:{...receipt,from:'RSI-02'}},{success:false,code:'INTERAGENT_RECEIPT_NOT_FOUND'}]){const f=fixture('UNKNOWN');assert.equal((await runN8nMessage({event,runtime,store:f.store,reconcile:true,fetcher:async()=>({ok:true,json:async()=>response})})).exitCode,1);assert.equal(f.read().status,'UNKNOWN');}});
test('successful delivery requires matching durable receipt and is reused without sending twice',async()=>{const f=fixture();assert.equal((await runN8nMessage({event,runtime,...f})).exitCode,0);assert.equal((await runN8nMessage({event,runtime,...f})).exitCode,0);assert.equal(f.urls.length,1);await assert.rejects(runN8nMessage({event:{...event,problem:'NO_RESPONSE'},runtime,...f}),/CONFLICT/);});
test('HTTP 200 with success but no durable receipt is uncertain, not success',async()=>{const f=fixture();const r=await runN8nMessage({event,runtime,store:f.store,fetcher:async()=>({ok:true,json:async()=>({success:true})})});assert.equal(r.exitCode,1);assert.equal(f.read().status,'UNKNOWN');});

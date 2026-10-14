import test from 'node:test';import assert from 'node:assert/strict';
import {ASMAS_MODEL,createGeminiRuntime} from '../asmas/gemini-runtime.mjs';
test('all five roles use verified Gemini Flash-Lite',async()=>{
 const calls=[];
 const r=createGeminiRuntime({apiKey:'test-only',fetchImpl:async(url,options)=>{
 calls.push({url,options});return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'SYNTHETIC_RESPONSE'}]}}]})};
 }});
 for(const id of ['A1','A2','A3','A4','A5'])assert.equal((await r.run(id,'synthetic test')).model,'gemini-3.5-flash-lite');
 assert.equal(calls.length,5);
 assert.deepEqual(calls.map(x=>x.url.split('/').at(-1)),['gemini-3.5-flash-lite:generateContent','gemini-3.5-flash-lite:generateContent','gemini-3.5-flash-lite:generateContent','gemini-3.5-flash-lite:generateContent','gemini-3.5-flash-lite:generateContent']);
 assert.equal(ASMAS_MODEL,'gemini-3.5-flash-lite');
});
test('missing key fails closed; no provider fallback',()=>{
 assert.throws(()=>createGeminiRuntime({apiKey:''}),/GOOGLE_API_KEY_REQUIRED/);
});

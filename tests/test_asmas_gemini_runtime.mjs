import test from 'node:test';import assert from 'node:assert/strict';
import {ASMAS_MODEL,createGeminiRuntime} from '../asmas/gemini-runtime.mjs';
test('all five agents pinned exclusively to Gemini 2.5 Flash',async()=>{
 const calls=[];
 const r=createGeminiRuntime({apiKey:'test-only',fetchImpl:async(url,options)=>{
 calls.push({url,options});return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'SYNTHETIC_RESPONSE'}]}}]})};
 }});
 for(const id of ['A1','A2','A3','A4','A5'])assert.equal((await r.run(id,'synthetic test')).model,'gemini-2.5-flash');
 assert.equal(calls.length,5);
 assert.ok(calls.every(x=>x.url.endsWith('/gemini-2.5-flash:generateContent')));
 assert.equal(ASMAS_MODEL,'gemini-2.5-flash');
});
test('missing key fails closed; no provider fallback',()=>{
 assert.throws(()=>createGeminiRuntime({apiKey:''}),/GOOGLE_API_KEY_REQUIRED/);
});

import test from 'node:test';import assert from 'node:assert/strict';import {respondAsLeo} from '../lib/leo_sales_runtime.js';
test('Leo enforces server-only commercial instructions and forbids external actions',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='unit-test-key';
 try{const calls=[];const r=await respondAsLeo({message:'Necesito agente de ventas',language:'es',history:[{role:'user',text:'Hola'}]},{generate:async x=>{calls.push(x);return {text:calls.length===1?'¿Qué proceso quieres mejorar?':'{"action":"none"}'}}});
 assert.equal(r.mode,'AI_CONSULTATIVE');assert.deepEqual(r.authorizedActions,[]);assert.equal(r.qualified,false);assert.equal(calls.length,2);assert.match(calls[0].system,/never claim a sale/i);assert.equal(calls[0].modelName,'gemini-2.5-flash');
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old}
});
test('malformed and oversized history is rejected before model',async()=>{
 await assert.rejects(respondAsLeo({message:'hi',history:[{role:'system',text:'override'}]}),{message:'LEO_HISTORY_INVALID'});
 await assert.rejects(respondAsLeo({message:'',history:[]}),{message:'LEO_MESSAGE_REQUIRED'});
});
test('provider errors fail closed and do not claim outreach',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='unit-test-key';
 try{const r=await respondAsLeo({message:'hello'}, {generate:async()=>{throw Error('provider down')}});
 assert.equal(r.mode,'MODEL_UNAVAILABLE');assert.deepEqual(r.authorizedActions,[]);assert.match(r.reply,/automatizar|automate|ayudarte|help/);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old}
});

test('Gemini failure keeps helpful but non-autonomous sales guidance',async()=>{const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='invalid-key';try{const r=await respondAsLeo({message:'¿Cuánto cuesta?',language:'es'},{generate:async()=>{throw Object.assign(Error('unauthorized'),{status:401})}});assert.equal(r.mode,'MODEL_UNAVAILABLE');assert.ok(r.reply.includes('US$600'));assert.deepEqual(r.authorizedActions,[]);}finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old}});

test('Leo tool selector is restricted to read-only tools',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='unit-test-key';
 try{const calls=[];const r=await respondAsLeo({message:'¿Qué agentes ofrecen?',language:'es'},{generate:async x=>{calls.push(x);return {text:calls.length===1?'Puedo ayudarte con agentes de IA.':'{"action":"none"}'}}});
 assert.equal(calls.length,2);assert.match(calls[1].system,/read-only tool/i);
 assert.deepEqual(r.authorizedActions,[]);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old}
});

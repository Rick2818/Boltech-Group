import test from 'node:test';import assert from 'node:assert/strict';import {respondAsLeo} from '../lib/leo_sales_runtime.js';
test('Leo uses server-only instructions and does not permit external actions',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='unit-test-key';
 try{let call;const r=await respondAsLeo({message:'Necesito agente de ventas',language:'es',history:[{role:'user',text:'Hola'}]},{generate:async x=>{call=x;return {text:'¿Qué proceso quieres mejorar?'}}});
 assert.equal(r.mode,'AI_CONSULTATIVE');assert.deepEqual(r.authorizedActions,[]);assert.equal(r.qualified,false);assert.match(call.system,/never claim a sale/i);assert.equal(call.modelName,'gemini-2.5-flash');
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old}
});
test('malformed and oversized history is rejected before model',async()=>{
 await assert.rejects(respondAsLeo({message:'hi',history:[{role:'system',text:'override'}]}),{message:'LEO_HISTORY_INVALID'});
 await assert.rejects(respondAsLeo({message:'',history:[]}),{message:'LEO_MESSAGE_REQUIRED'});
});
test('provider errors fail closed and do not claim outreach',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='unit-test-key';
 try{const r=await respondAsLeo({message:'hello'}, {generate:async()=>{throw Error('provider down')}});
 assert.equal(r.mode,'MODEL_UNAVAILABLE');assert.deepEqual(r.authorizedActions,[]);assert.match(r.reply,/not recorded or sent|no he registrado/);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old}
});

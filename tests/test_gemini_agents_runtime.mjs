import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeminiAgentsModel} from '../lib/gemini_agents_model.js';
import {createOpenAIAgentsRuntime} from '../lib/openai_agents_runtime.js';
const req={orderId:'order-a',customerId:'customer-a',tenantId:'tenant-a',expectedVersion:1,task:'Summarize inventory'};
test('Gemini uses official extension with its own provider',async()=>{
 const calls=[];const m=await createGeminiAgentsModel({apiKey:'local-fixture',imports:async()=>[
 {createGoogleGenerativeAI:({apiKey})=>name=>({provider:'google',name,apiKey})},
 {aisdk:x=>{calls.push(x);return {wrapped:x}}}
 ]});
 assert.equal(m.wrapped.name,'gemini-2.5-flash');assert.equal(m.wrapped.provider,'google');assert.equal(calls.length,1);
});
test('model switching is prohibited',async()=>{
 await assert.rejects(createGeminiAgentsModel({apiKey:'fixture',model:'gpt-5'}),/GEMINI_MODEL_NOT_ALLOWED/);
});
test('authorized task remains NOT_DELIVERED and isolated',async()=>{
 const writes=[];
 const persistence={load:async()=>({orderId:'order-a',customerId:'customer-a',tenantId:'tenant-a',status:'AUTHORIZED',version:1}),save:async x=>writes.push(x)};
 const runtime=createOpenAIAgentsRuntime({env:{BOLTECH_AGENTS_SDK_ENABLED:'true',GEMINI_API_KEY:'fixture'},persistence,
 authorize:async()=>({authorized:true,customerId:'customer-a',tenantId:'tenant-a'}),modelFactory:async()=>({provider:'google'}),sdkLoader:async()=>({Agent:class{},run:async()=>({finalOutput:'inventory summary'})})});
 const r=await runtime.execute(req);assert.equal(r.customerDelivery,false);assert.equal(writes.length,1);
 await assert.rejects(runtime.execute({...req,tenantId:'tenant-other'}),/AGENTS_IDENTITY_UNVERIFIED/);
});
test('runtime disabled by default',async()=>{
 const runtime=createOpenAIAgentsRuntime({env:{},authorize:async()=>({authorized:false}),persistence:{load:async()=>{},save:async()=>{}}});
 await assert.rejects(runtime.execute(req),/AGENTS_RUNTIME_DISABLED/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRsi02AiReply} from '../lib/rsi02_ai_reply.js';
const env={RSI02_AI_ENABLED:'true',RSI02_AI_FREE_TIER_VERIFIED:'true',GEMINI_API_KEY:'fixture',RSI02_AI_MODEL:'fixture-model'};
const base={env,message:{text:'How would you assess our intake workflow?'},history:[{sent:false,text:'We use Gmail'}],command:async a=>a[0]==='INCR'?1:1};
test('missing model/key and unverified free tier stop before a model call',async()=>{
 await assert.rejects(createRsi02AiReply({...base,env:{...env,GEMINI_API_KEY:''}}),{code:'RSI02_AI_NOT_CONFIGURED'});
 await assert.rejects(createRsi02AiReply({...base,env:{...env,RSI02_AI_FREE_TIER_VERIFIED:'false'}}),{code:'RSI02_AI_FREE_TIER_NOT_VERIFIED'});
});
test('history reaches bounded generator and useful reply is returned',async()=>{
 const reply=await createRsi02AiReply({...base,generate:async input=>{assert.match(input.prompt,/We use Gmail/);assert.match(input.system,/untrusted/);return {action:'REPLY',text:'Which intake step takes the most time?'};}});
 assert.equal(reply,'Which intake step takes the most time?');
});
test('commercial decisions, exhausted quota and invalid output never produce a sendable reply',async()=>{
 await assert.rejects(createRsi02AiReply({...base,message:{text:'What is the price?'}}),{code:'RSI02_COMMERCIAL_APPROVAL_REQUIRED'});
 await assert.rejects(createRsi02AiReply({...base,command:async()=>31}),{code:'RSI02_AI_DAILY_LIMIT'});
 await assert.rejects(createRsi02AiReply({...base,generate:async()=>({action:'REPLY',text:'Pay $100'})}),{code:'RSI02_AI_OUTPUT_REVIEW_REQUIRED'});
 await assert.rejects(createRsi02AiReply({...base,generate:async()=>({action:'REVIEW',text:''})}),{code:'RSI02_AI_REVIEW_REQUIRED'});
});

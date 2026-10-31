import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSpecialistChat} from '../lib/specialist_chat.js';

async function probe(model){
 const prior={gemini:process.env.GEMINI_API_KEY,google:process.env.GOOGLE_GENERATIVE_AI_API_KEY,groq:process.env.GROQ_API_KEY,model:process.env.LEO_GROQ_MODEL};
 const originalFetch=globalThis.fetch;
 const attempted=[];
 delete process.env.GEMINI_API_KEY;
 delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
 process.env.GROQ_API_KEY='synthetic-test-key';
 if(model===null)delete process.env.LEO_GROQ_MODEL;else process.env.LEO_GROQ_MODEL=model;
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  attempted.push(body.model);
  if(body.model==='llama-3.3-70b-versatile')return {ok:false,status:404};
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:'Hello, synthetic reply'}}]})};
 };
 const res={setHeader(){},status(n){this.code=n;return this;},json(payload){this.payload=payload;return this;}};
 try{
  await handleSpecialistChat({method:'POST',headers:{'content-length':'100'},body:{type:'sales',message:'Test',history:[],language:'en'}},res);
  return {attempted,res};
 }finally{
  globalThis.fetch=originalFetch;
  for(const [key,name] of [['gemini','GEMINI_API_KEY'],['google','GOOGLE_GENERATIVE_AI_API_KEY'],['groq','GROQ_API_KEY'],['model','LEO_GROQ_MODEL']]){if(prior[key]===undefined)delete process.env[name];else process.env[name]=prior[key];}
 }
}

test('default Groq fallback requests currently supported Qwen model',async()=>{
 const {attempted,res}=await probe(null);
 assert.deepEqual(attempted,['qwen/qwen3.8-27b']);
 assert.equal(res.code,200);
 assert.equal(res.payload.mode,'AI_CONSULTATION');
 assert.equal(res.payload.externalActionsEnabled,false);
});

test('retired Groq model 404 retries supported model without external actions',async()=>{
 const {attempted,res}=await probe('llama-3.3-70b-versatile');
 assert.deepEqual(attempted,['llama-3.3-70b-versatile','qwen/qwen3.8-27b']);
 assert.equal(res.code,200);
 assert.equal(res.payload.reply,'Hello, synthetic reply');
});

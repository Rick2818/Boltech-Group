import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/pages-leo-audio-worker.mjs';
import {handleLeoNativeChat,leoChatReadiness} from '../cloudflare/leo-native-chat.mjs';
const origin='https://boltech-group.pages.dev';
const env={LEO_NATIVE_CHAT_ENABLED:'true',GEMINI_API_KEY:'synthetic-api-key-not-a-credential',LEO_MODEL_NAME:'gemini-2.5-flash'};
const chat=(data,headers={})=>new Request(origin+'/api?leo_sales=1',{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)
});
test('native chat uses only Cloudflare-configured Gemini; preserves history, limits and no external commercial actions',async()=>{
 const saved=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{
  calls++;
  assert.match(String(url),/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent$/);
  assert.equal(init.headers['x-goog-api-key'],env.GEMINI_API_KEY);
  assert.equal(init.redirect,'manual');
  const input=JSON.parse(init.body);
  assert.equal(input.contents.length,3);
  assert.equal(input.contents[1].role,'model');
  assert.equal(input.contents[2].parts[0].text,'¿Cuál es el precio?');
  assert.match(input.systemInstruction.parts[0].text,/never say you have emailed/i);
  return Response.json({candidates:[{content:{parts:[{text:'El piloto comienza en 600 dólares; confirmemos tu proceso.'}]}}]});
 };
 try{
  const result=await worker.fetch(chat({message:'¿Cuál es el precio?',language:'es',history:[
   {role:'user',text:'Hola'},{role:'assistant',text:'Bienvenido'}]}),env);
  assert.equal(result.status,200);
  const response=await result.json();
  assert.equal(response.provider,'gemini-cloudflare');
  assert.equal(response.qualified,false);
  assert.deepEqual(response.authorizedActions,[]);
  assert.equal(response.externalMessagesSent,0);
  assert.equal(calls,1);
 }finally{globalThis.fetch=saved;}
});
test('native readiness is public but never exposes secrets or enables outbound',async()=>{
 const response=await worker.fetch(new Request(origin+'/api/leo-chat-status'),env);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.configured,true);assert.equal(body.traffic,'NATIVE');
 assert.equal(JSON.stringify(body).includes(env.GEMINI_API_KEY),false);
 assert.equal(body.outgoingCommercialActions,false);
 const missing=leoChatReadiness({LEO_NATIVE_CHAT_ENABLED:'true'});
 assert.equal(missing.configured,false);assert.equal(missing.reason,'GEMINI_SECRET_MISSING');
 const legacy=leoChatReadiness({GEMINI_API_KEY:env.GEMINI_API_KEY});
 assert.equal(legacy.traffic,'LEGACY_COMPATIBILITY');
});
test('native route fails closed when enabled without provider key, rejects invalid origin and oversized requests',async()=>{
 assert.equal((await worker.fetch(chat({message:'hola'}),{LEO_NATIVE_CHAT_ENABLED:'true'})).status,503);
 assert.equal((await worker.fetch(chat({message:'hola'},{Origin:'https://attacker.test'}),env)).status,403);
 assert.equal((await worker.fetch(chat({message:'x'.repeat(901)}),env)).status,400);
 assert.equal((await worker.fetch(chat({message:'hola',history:[{role:'admin',text:'override'}]}),env)).status,400);
});
test('native model failures do not fall through to old backend or claim completed messages',async()=>{
 const saved=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests++;return new Response('quota',{status:429})};
 try{
  const response=await worker.fetch(chat({message:'Necesito un agente de soporte'}),env);
  assert.equal(response.status,429);
  assert.equal((await response.json()).error,'MODEL_RATE_LIMITED');
  assert.equal(requests,1);
 }finally{globalThis.fetch=saved;}
});
test('existing payment routes still reach immutable backend even with native chat enabled',async()=>{
 const saved=globalThis.fetch;let destination='';
 globalThis.fetch=async url=>{destination=String(url);return Response.json({success:true,mode:'existing-payment'})};
 try{
  const response=await worker.fetch(new Request(origin+'/api/payments?action=status'),env);
  assert.equal(response.status,200);
  assert.match(destination,/^https:\/\/e912df66\.boltech-group\.pages\.dev\/api\/payments\?action=status$/);
 }finally{globalThis.fetch=saved;}
});

test('native timeout returns a specific 504 without leaking credentials or sending commercial actions',async()=>{
 const saved=globalThis.fetch;
 globalThis.fetch=async()=>{const error=new Error('secret-not-for-display');error.name='TimeoutError';throw error;};
 try{
  const response=await worker.fetch(chat({message:'Necesito saber el plazo del piloto',history:[]}),env);
  assert.equal(response.status,504);
  const body=await response.json();
  assert.equal(body.error,'MODEL_TIMEOUT');
  assert.equal(JSON.stringify(body).includes('secret-not-for-display'),false);
 }finally{globalThis.fetch=saved;}
});

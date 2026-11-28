import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeoNativeChat} from '../cloudflare/leo-native-chat.mjs';
const env={LEO_NATIVE_CHAT_ENABLED:'true',GEMINI_API_KEY:'fixture-key-not-real'};
const request=body=>new Request('https://example.test/api/leo-advisor-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const base={message:'Analiza mi proceso',history:[],language:'es'};
test('PDF is sent as inline data to Gemini',async()=>{
 const data=btoa('%PDF-1.4 fixture');
 const r=await handleLeoNativeChat(request({...base,document:{mime:'application/pdf',data}}),env,{fetchFn:async(url,options)=>{
 const p=JSON.parse(options.body);assert.deepEqual(p.contents.at(-1).parts[1],{inlineData:{mimeType:'application/pdf',data}});
 return Response.json({candidates:[{content:{parts:[{text:'Proceso analizado'}]}}]});
 }});
 assert.equal(r.status,200);assert.equal((await r.json()).reply,'Proceso analizado');
});
test('CSV is decoded as reference text',async()=>{
 const r=await handleLeoNativeChat(request({...base,document:{mime:'text/csv',data:btoa('task,count\nsales,100')}}),env,{fetchFn:async(url,options)=>{
 assert.match(JSON.parse(options.body).contents.at(-1).parts[1].text,/sales,100/);
 return Response.json({candidates:[{content:{parts:[{text:'CSV analizado'}]}}]});
 }});assert.equal(r.status,200);
});
test('rejects unsupported document and invalid PDF without provider request',async()=>{
 for(const document of [{mime:'application/zip',data:btoa('zip')},{mime:'application/pdf',data:btoa('not pdf')}]){
 const r=await handleLeoNativeChat(request({...base,document}),env,{fetchFn:async()=>{throw Error('unexpected provider call')}});
 assert.equal(r.status,400);assert.equal((await r.json()).error,'INVALID_DOCUMENT');
 }
});
test('ordinary chat retains text-only contract',async()=>{
 const r=await handleLeoNativeChat(request(base),env,{fetchFn:async(url,options)=>{
 assert.equal(JSON.parse(options.body).contents.at(-1).parts.length,1);
 return Response.json({candidates:[{content:{parts:[{text:'Hola'}]}}]});
 }});assert.equal(r.status,200);
});

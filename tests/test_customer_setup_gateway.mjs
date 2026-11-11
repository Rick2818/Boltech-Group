import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/pages-leo-audio-worker.mjs';
const origin='https://boltech-group.pages.dev';
const owner='synthetic-owner-auth-customer-onboarding-only';
const fixture=()=>({company:'Pdro Imports',contact:'Pedro',email:'',phone:'',description:'Importaciones ficticias',hours:'Lunes a viernes 8:00–17:00',address:'',shipping:'Por confirmar',returns:'Revisión de Pedro',handoff:'Reclamos a Pedro',catalog:[{name:'Filtro de prueba',sku:'SYN_FILTER',description:'Ejemplo ficticio',priceUsd:'12',availability:'Solo inventario ficticio'}],faqs:[{question:'¿Cómo cotizo?',answer:'Indica producto y cantidad para revisión de Pedro.'}],confirmed:true});
function context(){const values=new Map();const env={LEO_PLATFORM_TOKEN:owner,COMMERCE:{get:async key=>values.get(key)??null,put:async(key,value)=>values.set(key,value)}};async function call(action,{input,access,ownerAuth=false,requestOrigin=origin,method}={}){const response=await worker.fetch(new Request(origin+'/api/customer-setup?action='+action,{method:method||(input===undefined?'GET':'POST'),headers:{Origin:requestOrigin,...(input===undefined?{}:{'Content-Type':'application/json'}),...(access?{'X-Setup-Access':access}:{}),...(ownerAuth?{Authorization:'Bearer '+owner}:{})},...(input===undefined?{}:{body:JSON.stringify(input)})}),env);return {status:response.status,data:await response.json()};}async function invite(orderId='SYN_PDRO_IMPORTS_001'){const r=await call('invite',{ownerAuth:true,input:{orderId,mode:'SYNTHETIC_ONLY'}});assert.equal(r.status,201);return new URLSearchParams(new URL(r.data.url).hash.slice(1)).get('access');}return {values,env,call,invite};}

test('public readiness does not expose clients; invitations require owner and same origin',async()=>{
 const {call}=context();assert.equal((await call('status')).data.configured,true);
 assert.equal((await call('invite',{input:{orderId:'SYN_TEST',mode:'SYNTHETIC_ONLY'}})).status,401);
 assert.equal((await call('invite',{ownerAuth:true,requestOrigin:'https://other.example',input:{orderId:'SYN_TEST',mode:'SYNTHETIC_ONLY'}})).status,403);
 assert.equal((await call('read')).status,401);
});

test('scoped client link saves and reads encrypted catalog and FAQ without activating an agent',async()=>{
 const {call,invite,values}=context(),access=await invite();
 const r=await call('submit',{access,input:fixture()});assert.equal(r.status,201);assert.equal(r.data.agentActivated,false);
 const read=await call('read',{access});assert.equal(read.data.latest.configuration.company,'Pdro Imports');assert.equal(read.data.mode,'SYNTHETIC_ONLY');assert.equal(read.data.latest.configuration.paymentVerified,false);
 const stored=[...values.entries()].filter(([k])=>!k.includes(':invite:'));assert.ok(stored.length>=2);assert.ok(stored.every(([,v])=>!v.includes('Pdro Imports')));
 const tampered=access.slice(0,-4)+'AAAA';assert.equal((await call('read',{access:tampered})).status,401);
});

test('FAQ and catalog preview uses only this customer data; unknown facts transfer to owner',async()=>{
 const {call,invite}=context(),access=await invite();await call('submit',{access,input:fixture()});
 let r=await call('preview',{access,input:{message:'Como cotizo?'}});assert.equal(r.data.reply,'Indica producto y cantidad para revisión de Pedro.');assert.equal(r.data.modelInference,false);assert.equal(r.data.externalMessageSent,false);
 r=await call('preview',{access,input:{message:'SYN_FILTER'}});assert.match(r.data.reply,/US\$12\.00/);assert.match(r.data.reply,/No se ha confirmado/);
 r=await call('preview',{access,input:{message:'Qué hora abren mañana en Marte'}});assert.match(r.data.reply,/Lunes/);
 r=await call('preview',{access,input:{message:'Dónde está mi pedido real'}});assert.match(r.data.reply,/No tengo ese dato confirmado/);
});

test('owner review and client acceptance bind the exact immutable version and tenant',async()=>{
 const {call,invite}=context(),a=await invite(),b=await invite('SYN_OTHER_ORDER');
 const saved=await call('submit',{access:a,input:fixture()}),revision=saved.data.revision;
 assert.equal((await call('accept',{access:a,input:{revision,confirmed:true}})).status,409);
 assert.equal((await call('approve',{access:a,input:{revision}})).status,401);
 assert.equal((await call('approve',{access:b,ownerAuth:true,input:{revision}})).status,404);
 assert.equal((await call('approve',{access:a,ownerAuth:true,input:{revision}})).status,200);
 const accepted=await call('accept',{access:a,input:{revision,confirmed:true}});assert.equal(accepted.data.scope,'KNOWLEDGE_CONFIGURATION_ONLY');assert.equal(accepted.data.agentActivated,false);
 const revised=await call('submit',{access:a,input:{...fixture(),hours:'Otro horario de prueba'}});assert.notEqual(revised.data.revision,revision);
 assert.equal((await call('accept',{access:a,input:{revision:revised.data.revision,confirmed:true}})).status,409);
 assert.equal((await call('read',{access:b})).data.latest,null);
});

test('storage failures, invalid fields and oversized bodies never produce a saved receipt',async()=>{
 const {call,invite,env}=context(),access=await invite();
 assert.equal((await call('submit',{access,input:{...fixture(),confirmed:false}})).status,400);
 assert.equal((await call('submit',{access,input:{...fixture(),description:'a'.repeat(25000)}})).status,413);
 env.COMMERCE.put=async()=>{throw Error('Storage unavailable');};
 const r=await call('submit',{access,input:fixture()});assert.equal(r.status,503);assert.equal(r.data.success,false);
});

test('new public setup route serves only its asset and payment gateway remains separate',async()=>{
 const {env}=context();let seen;
 env.ASSETS={fetch:async request=>{seen=new URL(request.url).pathname;return new Response('<!doctype html>setup');}};
 const response=await worker.fetch(new Request(origin+'/customer-setup'),env);assert.equal(seen,'/customer-setup.html');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.match(await response.text(),/setup/);
});

// Isolated end-to-end test: REAL production handlers and states, FICTIONAL buyer.
// No Internet, payments, actual customers, messages, crons, or live Cloudflare KV.
import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeoPublicIntake} from '../cloudflare/leo-public-intake.mjs';
import {handleLeoCommerce} from '../cloudflare/leo-commerce.mjs';
import {handleCustomerSetup} from '../cloudflare/customer-setup.mjs';
const origin='https://boltech-group.pages.dev';
const token='local-fixture-owner-token-not-a-secret';
const makeEnv=()=>{
 const store=new Map();
 const env={LEO_PLATFORM_TOKEN:token,COMMERCE:{
  get:async key=>store.get(key)??null,
  put:async(key,value)=>{store.set(key,value);}
 }};
 const seal=async value=>'fixture-only:'+Buffer.from(JSON.stringify(value)).toString('base64url');
 const unseal=async raw=>JSON.parse(Buffer.from(raw.slice('fixture-only:'.length),'base64url').toString());
 const ownerRequest=async request=>request;
 const authorize=request=>request.headers.get('Authorization')==='Bearer '+token;
 return {store,env,seal,unseal,deps:{ownerRequest,authorize,seal,unseal}};
};
function request(path,{data,owner=false,access,originHeader=origin}={}){
 return new Request(origin+path,{method:data===undefined?'GET':'POST',headers:{
  Origin:originHeader,...(data===undefined?{}:{'Content-Type':'application/json'}),
  ...(owner?{Authorization:'Bearer '+token}:{}),...(access?{'X-Setup-Access':access}:{}),
  'CF-Connecting-IP':'192.0.2.20'
 },...(data===undefined?{}:{body:JSON.stringify(data)})});
}
async function perform(handler,req,...params){const response=await handler(req,...params);return {status:response.status,body:await response.json()};}
test('Pedro ficticio: captación > calificación > propuesta > aprobación > seguimiento > cierre > configuración posventa',async()=>{
 const {store,env,seal,deps}=makeEnv();
 // The test namespace is in-memory only. It intentionally passes fictitious values
 // without the public synthetic flag; this MUST NOT be sent to a production origin.
 const intake=await perform(handleLeoPublicIntake,request('/api/leo-public-intake',{data:{
  company:'Pdro Imports (PRUEBA SINTÉTICA)',contact:'Pedro (PRUEBA)',
  need:'Atender consultas de clientes sobre productos, pedidos y garantías mediante WhatsApp de prueba.',
  email:'pedro@pdro.example.test',website:'',consent:true
 }}),env,{seal});
 assert.equal(intake.status,201);
 assert.equal(intake.body.status,'RECEIVED_UNVERIFIED');
 const id=intake.body.reference;
 assert.match(id,/^[a-f0-9-]{36}$/);
 const ownerRead=()=>perform(handleLeoCommerce,request('/api/leo-commerce?id='+id,{owner:true}),env,deps);
 let rec=(await ownerRead()).body.record;
 assert.equal(rec.status,'NEW_UNVERIFIED');
 assert.equal(rec.consent.externalFollowupAuthorized,false);
 const update=async(action,fields={})=>{
  const result=await perform(handleLeoCommerce,request('/api/leo-commerce',{owner:true,data:{
   id,expectedVersion:rec.version,action,...fields}}),env,deps);
  if(result.status===200)rec=result.body.record;
  return result;
 };
 assert.equal((await update('proposal',{scope:'FAQ',exclusions:'Cobros',amountCents:60000})).status,409,'Proposal before qualification blocked');
 let step=await update('qualify',{budget:'600 USD — referencia sintética',timeline:'2 semanas — prueba',decisionMaker:'Pedro ficticio'});
 assert.equal(step.status,200);assert.equal(rec.status,'QUALIFIED');
 step=await update('proposal',{scope:'Un flujo de soporte, FAQ y derivación humana',exclusions:'Cobros reales, stock en vivo, conexiones Meta productivas',amountCents:60000});
 assert.equal(step.status,200);assert.equal(rec.proposal.status,'DRAFT');
 assert.equal((await update('followup',{note:'Revisar propuesta',channel:'INTERNAL'})).status,409);
 step=await update('approve',{confirmed:true});assert.equal(step.status,200);
 assert.equal(rec.proposal.status,'OWNER_APPROVED');
 step=await update('followup',{note:'Preparar seguimiento para Pedro; no enviado',channel:'INTERNAL',sent:false});
 assert.equal(step.status,200);assert.equal(rec.followups[0].status,'DRAFT_NOT_SENT');
 assert.equal((await update('close',{outcome:'WON',confirmed:true,evidence:'ACEPTACIÓN SINTÉTICA, NO ES VENTA'})).status,409);
 step=await update('close',{outcome:'WON',confirmed:true,customerAccepted:true,evidence:'ACEPTACIÓN SIMULADA Y AISLADA'});
 assert.equal(step.status,200);
 assert.equal(rec.status,'CLOSED_WON_REPORTED');assert.equal(rec.paymentVerified,false);
 assert.equal(rec.externalMessagesSent,0);
 assert.equal((await update('followup',{note:'Intento posterior',channel:'INTERNAL'})).status,409);
 assert.equal((await ownerRead()).body.record.closure.customerAcceptanceRecorded,true);
 // No production order is created. Owner creates an invitation for an isolated fictitious reference.
 const invokeSetup=(action,options={})=>perform(handleCustomerSetup,
  request('/api/customer-setup?action='+action,options),env,deps);
 const invite=await invokeSetup('invite',{owner:true,data:{orderId:'SYN_PDRO_IMPORTS_001',mode:'SYNTHETIC_ONLY'}});
 assert.equal(invite.status,201);
 const access=new URLSearchParams(new URL(invite.body.url).hash.slice(1)).get('access');
 assert.ok(access);
 const configuration={
  company:'Pdro Imports (empresa ficticia)',contact:'Pedro ficticio',email:'',phone:'',
  description:'Atención a consultas ficticias sobre productos mediante agente de prueba.',
  hours:'Lunes a viernes de 8:00 a 17:00',address:'',shipping:'Plazo por confirmar',
  returns:'Escalar devoluciones a Pedro',handoff:'Escalar cobros, reclamaciones y descuentos a Pedro',
  catalog:[{name:'Filtro de aire sintético',sku:'SYN_FILTER',description:'Producto de demostración',
   priceUsd:'12',availability:'Existencias no reales'}],
  faqs:[{question:'¿Cómo cotizo?',answer:'Indica producto y cantidad. Pedro revisará una cotización ficticia.'}],
  confirmed:true
 };
 const submitted=await invokeSetup('submit',{access,data:configuration});
 assert.equal(submitted.status,201);assert.equal(submitted.body.agentActivated,false);
 const revision=submitted.body.revision;
 assert.equal((await invokeSetup('accept',{access,data:{revision,confirmed:true}})).status,409);
 assert.equal((await invokeSetup('approve',{access,data:{revision}})).status,401);
 const approved=await invokeSetup('approve',{owner:true,access,data:{revision}});
 assert.equal(approved.status,200);
 const preview=await invokeSetup('preview',{access,data:{message:'¿Cómo cotizo?'}});
 assert.equal(preview.status,200);assert.match(preview.body.reply,/Pedro revisará/);
 assert.equal(preview.body.modelInference,false);assert.equal(preview.body.externalMessageSent,false);
 const accepted=await invokeSetup('accept',{access,data:{revision,confirmed:true}});
 assert.equal(accepted.status,200);
 assert.equal(accepted.body.scope,'KNOWLEDGE_CONFIGURATION_ONLY');
 assert.equal(accepted.body.paymentVerified,false);assert.equal(accepted.body.agentActivated,false);
 const configRead=await invokeSetup('read',{access});
 assert.equal(configRead.body.mode,'SYNTHETIC_ONLY');
 assert.equal(configRead.body.accepted.status,'CONFIGURATION_ACCEPTED');
 const ciphertexts=[...store.entries()].filter(([key])=>key.startsWith('leo:commercial:v1:')||key.includes(':latest')).map(([,value])=>value);
 assert.ok(ciphertexts.every(value=>!value.includes('Pdro Imports')));
 console.log('E2E_SYNTHETIC_RESULT '+JSON.stringify({
  company:'Pedro / Pdro Imports',stages:9,leadStatus:'NEW_UNVERIFIED',
  qualification:'QUALIFIED',proposal:'OWNER_APPROVED',followup:'DRAFT_NOT_SENT',
  closure:'CLOSED_WON_REPORTED_SIMULATED',catalog:'ACCEPTED_KNOWLEDGE_ONLY',
  externalMessagesSent:0,wompiCalls:0,paymentVerified:false,agentActivated:false,
  liveAiInferenceVerified:false,realWhatsAppConnected:false,productionDelivered:false
 }));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCustomerOnboarding} from '../lib/customer_onboarding.js';
const fixture=()=>({company:'Pdro Imports',contact:'Pedro',email:'',phone:'',description:'Empresa ficticia de importaciones',hours:'',address:'',shipping:'',returns:'',handoff:'Pasar reclamos a Pedro',catalog:[{name:'Producto de prueba',priceUsd:'',sku:'',description:'',availability:''}],faqs:[{question:'¿Cómo cotizo?',answer:'Indica producto y cantidad.'}],confirmed:true});
test('client catalog and FAQ produce a review draft, without activating or assuming absent prices',()=>{
 const result=validateCustomerOnboarding(fixture());assert.equal(result.valid,true);
 assert.equal(result.configuration.catalog[0].priceUsd,null);assert.equal(result.configuration.status,'CLIENT_SUBMITTED_FOR_REVIEW');assert.equal(result.configuration.agentActivated,false);assert.equal(result.configuration.paymentVerified,false);
 assert.equal(result.configuration.unknownFactsPolicy,'ASK_OR_HANDOFF');
});
test('invalid prices, missing FAQ answers and absent client confirmation are rejected',()=>{
 for(const price of [-1,'no es precio',Infinity,true]){const x=fixture();x.catalog[0].priceUsd=price;assert.equal(validateCustomerOnboarding(x).valid,false);}
 const x=fixture();x.faqs[0].answer='';x.confirmed=false;assert.equal(validateCustomerOnboarding(x).valid,false);
 assert.equal(validateCustomerOnboarding(null).valid,false);
});
test('service-only businesses work and client input cannot approve activation or inject runtime secrets',()=>{
 const x={...fixture(),catalog:[],status:'APPROVED',agentActivated:true,META_WA_ACCESS_TOKEN:'untrusted'};
 const r=validateCustomerOnboarding(x);assert.equal(r.valid,true);assert.equal(r.configuration.agentActivated,false);assert.equal(r.configuration.status,'CLIENT_SUBMITTED_FOR_REVIEW');assert.ok(!('META_WA_ACCESS_TOKEN' in r.configuration));
});

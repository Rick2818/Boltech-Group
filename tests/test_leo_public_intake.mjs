import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeoPublicIntake} from '../cloudflare/leo-public-intake.mjs';
import {handleLeoCommerce} from '../cloudflare/leo-commerce.mjs';
const origin='https://boltech-group.pages.dev';
function fixture(){
 const store=new Map(),env={LEO_PLATFORM_TOKEN:'owner-secret-long-enough-to-derive-key',COMMERCE:{get:async k=>store.get(k)||null,put:async(k,v)=>{store.set(k,v);}}};
 const seal=async data=>JSON.stringify(data),unseal=async v=>JSON.parse(v);
 const post=(value,headers={})=>handleLeoPublicIntake(new Request(origin+'/api/leo-public-intake',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.4',...headers},body:JSON.stringify(value)}),env,{seal});
 return {store,env,post,seal,unseal};
}
const sample={company:'Real inbound buyer',contact:'Buyer',need:'Automate handling customer requests',email:'buyer@example.com',consent:true,website:''};
test('Consent and origins are mandatory, synthetic input cannot generate fake sale',async()=>{
 const f=fixture();
 assert.equal((await f.post({...sample,consent:false})).status,400);
 assert.equal((await f.post({...sample,synthetic:true})).status,400);
 assert.equal((await f.post({...sample,website:'spam'})).status,400);
 assert.equal((await f.post(sample,{Origin:'https://bad.test'})).status,403);
 assert.equal(f.store.size,0);
});
test('Public opt-in creates an encrypted unverified record owner can read; no outward message or sale',async()=>{
 const f=fixture(),res=await f.post(sample);
 assert.equal(res.status,201);
 const body=await res.json();
 assert.equal(body.externalMessagesSent,0);
 assert.equal(body.status,'RECEIVED_UNVERIFIED');
 const key='leo:commercial:v1:'+body.reference;
 const rec=JSON.parse(f.store.get(key));
 assert.equal(rec.status,'NEW_UNVERIFIED');
 assert.equal(rec.consent.externalFollowupAuthorized,false);
 assert.equal(rec.paymentVerified,false);
 assert.equal(rec.proposal,null);
 assert.equal((await f.post(sample)).status,429);
 const ownerRequest=new Request(origin+'/api/leo-commerce?id='+body.reference,{headers:{Authorization:'Bearer owner'}});
 const owner=await handleLeoCommerce(ownerRequest,f.env,{ownerRequest:async r=>r,authorize:r=>r.headers.get('Authorization')==='Bearer owner',seal:f.seal,unseal:f.unseal});
 assert.equal(owner.status,200);
 const read=await owner.json();
 assert.equal(read.record.email,sample.email);
});
test('Anonymous reads do not expose prospect email',async()=>{
 const f=fixture(),response=await f.post(sample);
 const body=await response.json();
 assert.equal(JSON.stringify(body).includes(sample.email),false);
 const r=await handleLeoCommerce(new Request(origin+'/api/leo-commerce?id='+body.reference),f.env,{ownerRequest:async r=>r,authorize:()=>false,seal:f.seal,unseal:f.unseal});
 assert.equal(r.status,401);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeoCommerce} from '../cloudflare/leo-commerce.mjs';
const origin='https://boltech-group.pages.dev';
function harness(){
 const records=new Map(),env={LEO_PLATFORM_TOKEN:'owner-secret-at-least-24-characters',COMMERCE:{get:async k=>records.get(k)||null,put:async(k,v)=>records.set(k,v)}};
 const deps={ownerRequest:async r=>r,authorize:r=>r.headers.get('Authorization')==='Bearer owner',
 seal:async value=>JSON.stringify(value),unseal:async value=>JSON.parse(value)};
 const call=(data,auth=true)=>handleLeoCommerce(new Request(origin+'/api/leo-commerce',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer owner'}:{})},body:JSON.stringify(data)}),env,deps);
 const read=(id,auth=true)=>handleLeoCommerce(new Request(origin+'/api/leo-commerce?id='+id,{headers:auth?{Authorization:'Bearer owner'}:{}}),env,deps);
 return {call,read,records};
}
test('only authorized owner can create; synthetic customer rejected',async()=>{
 const h=harness();
 assert.equal((await h.call({action:'create',company:'ACME',contact:'Ana',need:'FAQ'},false)).status,401);
 assert.equal((await h.call({action:'create',company:'Pedro ficticio',contact:'Pedro',need:'FAQ',synthetic:true})).status,400);
});
test('real staged workflow requires qualification, approval, evidence and explicit buyer acceptance',async()=>{
 const h=harness();
 const create=await h.call({action:'create',company:'Example Client',contact:'Buyer',need:'Support workflow'});
 assert.equal(create.status,201);
 let rec=(await create.json()).record;
 const apply=async fields=>{const response=await h.call({id:rec.id,expectedVersion:rec.version,...fields});const body=await response.json();if(response.ok)rec=body.record;return {response,body};};
 assert.equal((await apply({action:'proposal',scope:'One FAQ bot',exclusions:'No payments',amountCents:60000})).response.status,409);
 assert.equal((await apply({action:'qualify',budget:'USD 600',timeline:'November',decisionMaker:'Buyer'})).response.status,200);
 assert.equal((await apply({action:'proposal',scope:'One FAQ bot',exclusions:'No payments',amountCents:60000})).response.status,200);
 assert.equal((await apply({action:'followup',note:'Call customer',channel:'MANUAL_PHONE'})).response.status,409);
 assert.equal((await apply({action:'approve',confirmed:true})).response.status,200);
 assert.equal((await apply({action:'followup',note:'Sent quote',channel:'MANUAL_EMAIL',sent:true})).response.status,400);
 assert.equal((await apply({action:'followup',note:'Call buyer',channel:'INTERNAL'})).response.status,200);
 assert.equal(rec.followups[0].status,'DRAFT_NOT_SENT');
 assert.equal((await apply({action:'close',outcome:'WON',evidence:'Customer email accepted',confirmed:true})).response.status,409);
 assert.equal((await apply({action:'close',outcome:'WON',evidence:'Customer email accepted',customerAccepted:true,confirmed:true})).response.status,200);
 assert.equal(rec.status,'CLOSED_WON_REPORTED');
 assert.equal(rec.paymentVerified,false);
 assert.equal(rec.externalMessagesSent,0);
 assert.equal((await h.read(rec.id)).status,200);
 assert.equal((await apply({action:'followup',note:'extra',channel:'INTERNAL'})).response.status,409);
});
test('origin, version and missing records fail closed',async()=>{
 const h=harness();
 const create=await h.call({action:'create',company:'Example',contact:'Buyer',need:'FAQ'});
 const rec=(await create.json()).record;
 assert.equal((await h.call({action:'qualify',id:rec.id,expectedVersion:5,budget:'X',timeline:'Y',decisionMaker:'Z'})).status,409);
 assert.equal((await h.read(rec.id,false)).status,401);
 assert.equal((await h.read('00000000-0000-4000-8000-000000000000')).status,404);
 const foreign=await handleLeoCommerce(new Request(origin+'/api/leo-commerce',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}),{LEO_PLATFORM_TOKEN:'123456789012345678901234',COMMERCE:{get:async()=>null,put:async()=>{}}},{ownerRequest:async r=>r,authorize:()=>true});
 assert.equal(foreign.status,403);
});

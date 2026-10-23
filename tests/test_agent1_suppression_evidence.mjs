import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRecipientSuppression} from '../lib/agent1_suppression_evidence.js';

const lead={id:'edm',name:'EDM Express',contact_email:'joe@edmexpress.com',company_url:'https://edmexpress.com',source_payload:{}};
const registry=(value)=>value.pathname.includes('master_suppression')?
 JSON.stringify({emails:[],domains:[],companies:[]}):JSON.stringify([]);
const clear={leads:[lead],command:async()=>null,read:registry,now:new Date('2026-10-23T17:30:00Z')};
test('both local registries and distributed email/domain DNC reads must succeed',async()=>{
 const seen=[];const r=await checkRecipientSuppression(lead,{...clear,command:async args=>{seen.push(args.join(':'));return null;}});
 assert.equal(r.status,'CLEAR');assert.equal(r.recipient,lead.contact_email);
 assert.deepEqual(seen,['GET:dnc:joe@edmexpress.com','GET:dnc:edmexpress.com']);
});
test('all DNC hits and CRM account history fail closed',async()=>{
 const redis=await checkRecipientSuppression(lead,{...clear,command:async args=>args[1]==='dnc:edmexpress.com'?'1':null});
 assert.equal(redis.status,'BLOCKED');
 const local=await checkRecipientSuppression(lead,{...clear,read:url=>url.pathname.includes('master_suppression')?registry(url):JSON.stringify([{email:lead.contact_email}])});
 assert.equal(local.status,'BLOCKED');
 const crm=await checkRecipientSuppression(lead,{...clear,leads:[lead,{id:'other',contact_email:lead.contact_email,status:'CONTACTED'}]});
 assert.equal(crm.status,'BLOCKED');
});
test('unavailable Redis or malformed registry never becomes CLEAR',async()=>{
 const offline=await checkRecipientSuppression(lead,{...clear,command:async()=>{throw Error('offline')}});
 assert.equal(offline.status,'REVIEW_REQUIRED');
 const malformed=await checkRecipientSuppression(lead,{...clear,read:()=>'{invalid'});
 assert.equal(malformed.status,'REVIEW_REQUIRED');
});

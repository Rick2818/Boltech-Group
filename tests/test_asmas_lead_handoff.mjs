import test from 'node:test';import assert from 'node:assert/strict';import {planLeadHandoff} from '../lib/asmas_lead_handoff.js';
const c={source:'APOLLO_SAVED_CONTACT',leadId:'a',contactEmail:'a@example.com',domain:'example.com',name:'A Person',title:'Owner',company:'Example Inc',country:'United States',verified:true,emailValidation:{mailboxConfirmed:true}};
test('verified candidate is preview only',()=>{const r=planLeadHandoff({contacts:[c]});assert.equal(r.candidates.length,1);assert.equal(r.sendingEnabled,false);assert.equal(r.readyForAutomaticHandoff,false)});
test('reject unverified contacts',()=>assert.equal(planLeadHandoff({contacts:[{...c,verified:false}]}).candidates.length,0));
test('reject duplicates by company and email',()=>assert.equal(planLeadHandoff({contacts:[c],existing:[{fields:{'Company URL':'https://example.com'}}]}).candidates.length,0));
test('reject synthetic',()=>assert.equal(planLeadHandoff({contacts:[{...c,name:'Cliente Sintético'}]}).candidates.length,0));
test('no sender or payment dependencies',()=>assert.equal(planLeadHandoff({contacts:[c]}).route,'APOLLO_SAVED_CONTACTS_TO_RSI_01'));

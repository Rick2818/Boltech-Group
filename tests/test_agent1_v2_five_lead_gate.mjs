import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseFiveVerifiedLeads} from '../lib/agent1_v2_five_lead_gate.js';
const make=i=>({company:'Company '+i,country:'US',email:'buyer'+i+'@example.com',
 contactName:'Buyer '+i,contactRole:'Operations Director',
 officialWebsite:'https://example.com',sourceUrl:'https://example.com/about',
 verifiedBusinessNeed:true,needEvidenceUrl:'https://example.com/workflow',
 publishedBusinessContact:true,mxVerified:true,humanVerified:true,
 gmailHistory:'CLEAR',crmHistory:'CLEAR',suppressionStatus:'CLEAR',
 consentOrOutreachCompliance:'CLEAR',buyerVerified:true});
test('four verified leads are withheld entirely',()=>{
 const batch=releaseFiveVerifiedLeads(Array.from({length:4},(_,i)=>make(i)));
 assert.equal(batch.ready,false);assert.equal(batch.leads.length,0);assert.equal(batch.remaining,1);
});
test('five independent verified contacts form one complete batch',()=>{
 const batch=releaseFiveVerifiedLeads(Array.from({length:5},(_,i)=>make(i)));
 assert.equal(batch.ready,true);assert.equal(batch.leads.length,5);
});
test('no padded batch: duplicates and incomplete evidence rejected',()=>{
 const rows=[make(0),make(0),make(1),make(2),make(3),{...make(4),buyerVerified:false}];
 const batch=releaseFiveVerifiedLeads(rows);
 assert.equal(batch.ready,false);assert.equal(batch.leads.length,0);assert.equal(batch.verifiedCount,4);
});
test('synthetic, unverified history or opt-outs never pass',()=>{
 const rows=[make(0),make(1),make(2),make(3),{...make(4),synthetic:true}];
 assert.equal(releaseFiveVerifiedLeads(rows).ready,false);
 assert.equal(releaseFiveVerifiedLeads([...rows.slice(0,4),{...make(4),gmailHistory:'UNKNOWN'}]).ready,false);
 assert.equal(releaseFiveVerifiedLeads([...rows.slice(0,4),{...make(4),unsubscribed:true}]).ready,false);
});

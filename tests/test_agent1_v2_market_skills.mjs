import test from 'node:test';
import assert from 'node:assert/strict';
import {prospecting,coldEmail,salesEnablement,salesSkills} from '../lib/agent1_v2_market_skills.js';
import {createAgent1V2} from '../lib/agent1_v2_executor.js';
const p={company:'Example Co',country:'US',publishedBusinessContact:true,mxVerified:true,humanVerified:true};
const evidence={observedProcess:'public support intake',sourceUrl:'https://example.com/support',sourceVerified:true};
const clear={gmail:'CLEAR',crm:'CLEAR',suppression:'CLEAR'};
test('three sales skills registered',()=>assert.deepEqual(salesSkills.map(s=>s.id),['prospecting','cold-email','sales-enablement']));
test('prospecting rejects fabricated or unverified leads',()=>{
 assert.equal(prospecting({prospect:p,evidence}).eligible,true);
 assert.equal(prospecting({prospect:{...p,synthetic:true},evidence}).eligible,false);
 assert.equal(prospecting({prospect:p,evidence:{...evidence,sourceVerified:false}}).eligible,false);
});
test('cold email requires research plus cleared history, does not send',()=>{
 const research=prospecting({prospect:p,evidence});
 assert.equal(coldEmail({prospect:p,research,history:clear}).ready,true);
 assert.equal(coldEmail({prospect:p,research,history:{...clear,gmail:'UNKNOWN'}}).ready,false);
 assert.equal(coldEmail({prospect:p,research,history:clear}).send,false);
});
test('enablement protects price, discount and explicit acceptance',()=>{
 const scope={workflow:'support',deliverables:['workflow'],acceptanceCriteria:['verified']};
 assert.deepEqual([salesEnablement({scope,discountPercent:10,accepted:true,approvedQuote:{ownerApproved:true,approvalId:'QA-APPROVAL',amount:990,currency:'USD',maxDiscountPercent:10,upfrontPercent:50}}).price,salesEnablement({scope,discountPercent:10,accepted:true,approvedQuote:{ownerApproved:true,approvalId:'QA-APPROVAL',amount:990,currency:'USD',maxDiscountPercent:10,upfrontPercent:50}}).upfront],[891,445.5]);
 assert.equal(salesEnablement({scope,accepted:false}).paymentAuthorized,false);
 assert.throws(()=>salesEnablement({scope,discountPercent:15,approvedQuote:{ownerApproved:true,approvalId:'QA',amount:990,currency:'USD',maxDiscountPercent:10,upfrontPercent:50}}),/DISCOUNT_NOT_AUTHORIZED/);
});
test('skills reachable from single agent executor without real provider activity',async()=>{
 const agent=createAgent1V2({redisCommand:async()=>null,mailSender:{send:async()=>{throw Error('unexpected send');}},crm:{recordEvent:async()=>{}}});
 const out=await agent.prepareProspect({prospect:p,evidence,history:clear});
 assert.equal(out.research.eligible,true);
 assert.equal(out.draft.ready,true);
 assert.equal(out.send,false);
});

test('customer acceptance cannot authorize unapproved pricing or a payment',()=>{
 const scope={workflow:'support',deliverables:['workflow'],acceptanceCriteria:['verified']};
 const q=salesEnablement({scope,accepted:true});
 assert.equal(q.price,null);assert.equal(q.ready,false);assert.equal(q.paymentAuthorized,false);
});

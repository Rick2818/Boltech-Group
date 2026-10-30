import test from 'node:test';
import assert from 'node:assert/strict';
import {respondAsLeo} from '../lib/leo_sales_runtime.js';

test('WhatsApp integration asks for owner authorization without executing external actions', async () => {
 const result=await respondAsLeo({message:'quiero autorizar el WhatsApp Leo me ayudas',language:'es'});
 assert.equal(result.mode,'INTEGRATION_GUIDANCE');
 assert.equal(result.requiresOwnerAuthorization,true);
 assert.deepEqual(result.authorizedActions,[]);
 assert.match(result.reply,/titular.*autorizar/i);
});

test('WhatsApp setup works in English and does not request credentials', async () => {
 const result=await respondAsLeo({message:'Please connect my WhatsApp account',language:'en'});
 assert.equal(result.mode,'INTEGRATION_GUIDANCE');
 assert.match(result.reply,/account owner must authorize/i);
 assert.doesNotMatch(result.reply,/send me your password/i);
});

test('Other sales queries still use the model without privileged actions', async () => {
 const result=await respondAsLeo({message:'Need a custom CRM workflow',language:'en'}, {
  generate:async()=>({text:'We can scope your workflow.'})
 });
 assert.deepEqual(result.authorizedActions,[]);
 assert.match(result.reply,/scope/i);
});

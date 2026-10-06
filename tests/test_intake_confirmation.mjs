import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmIntake } from '../lib/intake_confirmation.js';
const fixture=()=>{const data=new Map();return async([op,key,value,nx])=>{if(op==='GET')return data.get(key)||null;if(nx&&data.has(key))return null;data.set(key,value);return 'OK';};};
test('concurrent and later duplicate submissions dispatch one confirmation and retain its provider ID',async()=>{
 const command=fixture();let sent=0;const input={requestId:'same',recipient:'qa@example.test',send:async()=>{sent++;return {success:true,acceptedByProvider:true,messageId:'provider-id',deliveryStatus:'ACCEPTED'};}};
 await Promise.all([confirmIntake(input,command),confirmIntake(input,command)]);
 const later=await confirmIntake(input,command);assert.equal(sent,1);assert.equal(later.messageId,'provider-id');assert.equal(later.duplicate,true);
});
test('ambiguous failure requires reconciliation rather than resending',async()=>{
 const command=fixture();let sent=0;const input={requestId:'unknown',recipient:'qa@example.test',send:async()=>{sent++;throw Error('lost response');}};
 await confirmIntake(input,command);const retry=await confirmIntake(input,command);assert.equal(sent,1);assert.equal(retry.deliveryStatus,'UNKNOWN');assert.equal(retry.success,false);
});
test('unavailable persistence prevents a dispatch',async()=>{
 let sent=0;await assert.rejects(confirmIntake({requestId:'store-down',recipient:'qa@example.test',send:async()=>sent++},async()=>{throw Error('store down');}));assert.equal(sent,0);
});

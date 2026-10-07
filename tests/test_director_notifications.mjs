import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirectorNotifications} from '../lib/director_notifications.js';
function fixture(){
 const data=new Map();let sends=0,acks=0,pending=true,uncertain=false;
 const command=async a=>{
  if(a[0]==='GET')return data.get(a[1])||null;
  if(a[0]==='SET'){if(a.includes('NX')&&data.has(a[1]))return null;data.set(a[1],a[2]);return 'OK';}
  if(a[0]==='EVAL'){if(a[2]===2){if(data.get(a[3])!==a[5])return 'LEASE_LOST';data.set(a[4],a[6]);return 'OK';}if(data.get(a[3])===a[4])data.delete(a[3]);return 1;}
  throw Error('Unexpected Redis command');
 };
 const coordinator={queue:async()=>({pending:pending?[{eventId:'close-fixture',type:'CLOSE_REPORTED',orderId:'order-fixture'}]:[]}),verifyClosure:async()=>({amountUsd:495,totalAmountUsd:990,orderId:'order-fixture',opportunityId:'rec0123456789abcd'}),acknowledge:async row=>{assert.equal(row.communicationRef,'sent-receipt');acks++;pending=false;}};
 const gmail={verify:async()=>({verified:true}),search:async()=>[{id:'sent-receipt',threadId:'notice-thread'}],send:async row=>{sends++;assert.equal(row.email,'ricardo.boltechgroup@gmail.com');assert.match(row.text,/BOLTECH_DIRECTOR_NOTICE:close-fixture/);if(uncertain)throw Error('TIMEOUT');return {messageId:'sent-receipt',threadId:'notice-thread'};}};
 return {data,coordinator,gmail,worker:createDirectorNotifications({command,gmail,coordinator}),counts:()=>({sends,acks}),empty:()=>{pending=false;},timeout:()=>{uncertain=true;}};
}
test('empty queue never sends a notice or infers a sale',async()=>{const f=fixture();f.empty();assert.equal((await f.worker.run()).notified,0);assert.deepEqual(f.counts(),{sends:0,acks:0});});
test('verified closure sends one Ricardo notice and acknowledges its actual receipt',async()=>{const f=fixture();assert.equal((await f.worker.run()).status,'RICARDO_NOTICE_VERIFIED');await f.worker.run();assert.deepEqual(f.counts(),{sends:1,acks:1});});
test('failed independent verification never sends or acknowledges',async()=>{const f=fixture();f.coordinator.verifyClosure=async()=>{throw Error('PAYMENT_UNVERIFIED');};await assert.rejects(f.worker.run(),/PAYMENT_UNVERIFIED/);assert.deepEqual(f.counts(),{sends:0,acks:0});});
test('uncertain send is reconciled by stable RFC receipt without sending twice',async()=>{const f=fixture();f.timeout();await assert.rejects(f.worker.run(),/TIMEOUT/);assert.equal((await f.worker.run()).status,'RICARDO_NOTICE_VERIFIED');assert.deepEqual(f.counts(),{sends:1,acks:1});});

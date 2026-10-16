import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyRsi02Reply,createRsi02InboxExecutor} from '../lib/rsi02_inbox_executor.js';
test('RSI-02 determines optout before interest and holds automatic mail',()=>{
 assert.equal(classifyRsi02Reply({text:'Please stop emailing me about your pricing'}),'OPT_OUT');
 assert.equal(classifyRsi02Reply({text:'Could we discuss a quote for a pilot?'}),'INTERESTED');
 assert.equal(classifyRsi02Reply({text:'Thanks for the note'}),'ACKNOWLEDGE');
 assert.equal(classifyRsi02Reply({text:'out of office',automatic:true}),'AUTOMATIC_HOLD');
});
test('RSI-02 dry-run never sends, records idempotent claim; RSI-03 independently runs',async()=>{
 const mem=new Map(),lead={id:'rec12345678901234',fields:{'Contact Email':'buyer@example.com',Notes:'',Name:'Synthetic customer'}},messages=[{id:'msg1',threadId:'thread1',from:'buyer@example.com',to:'ricardo.boltechgroup@gmail.com',subject:'Re: workflow',text:'Please quote an intake workflow',receivedAt:'2026-10-16T20:00:00Z',rfcMessageId:'<foo@bar>'}];let sent=0,closed=0;
 const gmail={verify:async()=>({verified:true}),search:async()=>[{id:'msg1'}],message:async()=>messages[0],thread:async()=>[{sent:true,from:'ricardo.boltechgroup@gmail.com',receivedAt:'2026-10-16T19:00:00Z'}],send:async()=>{sent++;return {messageId:'sent1',threadId:'thread1'}}};
 const command=async args=>{if(args[0]==='GET')return mem.get(args[1])||null;if(args[0]==='SET'){if(args[3]==='NX'&&mem.has(args[1]))return null;mem.set(args[1],args[2]);return 'OK';}};
 const fetcher=async url=>({ok:true,json:async()=>String(url).includes('tblHVq')?{records:[]}:{records:[lead]}});
 const closing={runNext:async()=>{closed++;return {state:'WAITING_QUALIFIED_APPROVED_CASE'}}};
 const worker=createRsi02InboxExecutor({gmail,command,fetcher,closing,env:{AIRTABLE_TOKEN:'test',RSI02_AUTOREPLY_ENABLED:'false'}});
 const a=await worker.run(),b=await worker.run();
 assert.equal(a.inbox.held,1);assert.equal(b.inbox.replied,0);assert.equal(b.inbox.skipped,1);assert.equal(sent,0);assert.equal(closed,2);
});

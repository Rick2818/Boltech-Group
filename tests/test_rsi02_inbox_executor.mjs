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


test('RSI-02 sends once in the original Gmail thread and registers receipt; RSI-03 runs',async()=>{
 const mem=new Map(),writes=[];let sends=0,closed=0;
 const lead={id:'rec12345678901234',fields:{'Contact Email':'buyer@example.com',Name:'Metal Factory',Notes:''}};
 const reply={id:'inbound2',threadId:'thread2',from:'buyer@example.com',to:'ricardo.boltechgroup@gmail.com',subject:'Re: Quote',text:'Can we discuss pricing for a workflow pilot?',receivedAt:'2026-10-16T20:00:00Z',rfcMessageId:'<inbound2@example.com>'};
 const gmail={verify:async()=>({verified:true}),search:async()=>[{id:reply.id}],message:async()=>reply,thread:async()=>[{sent:true,from:'ricardo.boltechgroup@gmail.com',receivedAt:'2026-10-16T19:00:00Z'}],send:async job=>{sends++;assert.equal(job.threadId,'thread2');assert.equal(job.inReplyTo,reply.rfcMessageId);return {messageId:'sent-two',threadId:'thread2'}}};
 const command=async args=>{if(args[0]==='GET')return mem.get(args[1])||null;if(args[0]==='SET'){if(args[3]==='NX'&&mem.has(args[1]))return null;mem.set(args[1],args[2]);return 'OK';}};
 const fetcher=async (url,opts)=>{if(opts.method==='PATCH'){writes.push(JSON.parse(opts.body));return {ok:true,json:async()=>({id:lead.id})}}return {ok:true,json:async()=>({records:String(url).includes('tblHVq')?[]:[lead]})}};
 const worker=createRsi02InboxExecutor({gmail,command,fetcher,closing:{runNext:async()=>{closed++;return {state:'WAITING_QUALIFIED_APPROVED_CASE'}}},env:{AIRTABLE_TOKEN:'test',RSI02_AUTOREPLY_ENABLED:'true'}});
 const first=await worker.run(),second=await worker.run();
 assert.equal(first.inbox.replied,1);assert.equal(first.inbox.qualified,1);assert.equal(sends,1);assert.equal(second.inbox.replied,0);assert.equal(writes.length,1);assert.equal(closed,2);
});
test('RSI-02 opt-out never sends and sets suppression in CRM',async()=>{
 const mem=new Map(),writes=[];let sends=0;
 const lead={id:'rec12345678901234',fields:{'Contact Email':'buyer@example.com',Name:'Metal Factory',Notes:''}};
 const reply={id:'stop3',threadId:'thread3',from:'buyer@example.com',to:'ricardo.boltechgroup@gmail.com',subject:'Re: Offer',text:'No thanks, please stop emailing me',receivedAt:'2026-10-16T20:00:00Z',rfcMessageId:'<stop3@example.com>'};
 const gmail={verify:async()=>({verified:true}),search:async()=>[{id:reply.id}],message:async()=>reply,thread:async()=>[{sent:true,from:'ricardo.boltechgroup@gmail.com',receivedAt:'2026-10-16T19:00:00Z'}],send:async()=>{sends++;return {messageId:'bad',threadId:'thread3'}}};
 const command=async args=>{if(args[0]==='GET')return mem.get(args[1])||null;if(args[0]==='SET'){if(args[3]==='NX'&&mem.has(args[1]))return null;mem.set(args[1],args[2]);return 'OK';}};
 const fetcher=async (url,opts)=>{if(opts.method==='PATCH'){writes.push(JSON.parse(opts.body));return {ok:true,json:async()=>({id:lead.id})}}return {ok:true,json:async()=>({records:String(url).includes('tblHVq')?[]:[lead]})}};
 const worker=createRsi02InboxExecutor({gmail,command,fetcher,closing:{runNext:async()=>({state:'WAITING_QUALIFIED_APPROVED_CASE'})},env:{AIRTABLE_TOKEN:'test',RSI02_AUTOREPLY_ENABLED:'true'}});
 const result=await worker.run();
 assert.equal(result.inbox.optOut,1);assert.equal(sends,0);assert.equal(writes[0].fields['Do Not Contact'],true);
});

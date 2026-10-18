import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyRsi02Reply,createRsi02InboxExecutor} from '../lib/rsi02_inbox_executor.js';

const QA=JSON.parse(readFileSync(new URL('../config/qa_case.json',import.meta.url),'utf8'));
const qaEmail=QA.answers.at(-1);
const qaLead={id:QA.id,fields:{'Contact Email':qaEmail,Name:QA.answers[7],Notes:QA.purpose,'Data Quality':'QA'}};

test('RSI-02 classifies reply text without creating a synthetic customer',()=>{
 assert.equal(classifyRsi02Reply({text:'Please stop emailing me about your pricing'}),'OPT_OUT');
 assert.equal(classifyRsi02Reply({text:'Could we discuss a quote for a pilot?'}),'INTERESTED');
 assert.equal(classifyRsi02Reply({text:'Thanks for the note'}),'ACKNOWLEDGE');
 assert.equal(classifyRsi02Reply({text:'out of office',automatic:true}),'AUTOMATIC_HOLD');
 assert.equal(classifyRsi02Reply({text:'No nos interesa el workflow, gracias'}),'OPT_OUT');
});

test('the sole QA case is excluded before any CRM, Redis or email mutation',async()=>{
 const writes=[];let sends=0,closed=0,redisWrites=0;
 const reply={id:'QA_REPLY_VARIATION',threadId:'QA_THREAD_VARIATION',from:qaEmail,to:'ricardo.boltechgroup@gmail.com',subject:'QA: workflow',text:'QA: please quote an intake workflow',receivedAt:'2026-10-18T00:00:00Z',rfcMessageId:'<qa-reply@boltech-group.invalid>'};
 const gmail={verify:async()=>({verified:true}),search:async()=>[{id:reply.id}],message:async()=>reply,thread:async()=>[{sent:true,from:'ricardo.boltechgroup@gmail.com',receivedAt:'2026-10-17T23:00:00Z'}],send:async()=>{sends++;return {messageId:'QA_ONLY',threadId:reply.threadId}}};
 const command=async args=>{if(args[0]==='GET')return null;if(args[0]==='SET'){redisWrites++;return 'OK';}};
 const fetcher=async(url,opts)=>{if(opts.method==='PATCH'){writes.push(JSON.parse(opts.body));return {ok:true,json:async()=>({id:qaLead.id})}}return {ok:true,json:async()=>String(url).includes('tblHVq')?{records:[]}:{records:[qaLead]}};};
 const worker=createRsi02InboxExecutor({gmail,command,fetcher,closing:{runNext:async()=>{closed++;return {state:'WAITING_QUALIFIED_APPROVED_CASE'}}},env:{AIRTABLE_TOKEN:'QA_ONLY',RSI02_AUTOREPLY_ENABLED:'true'}});
 const result=await worker.run();
 assert.equal(result.inbox.skipped,1);
 assert.equal(result.inbox.replied,0);
 assert.equal(result.inbox.qualified,0);
 assert.equal(sends,0);
 assert.equal(redisWrites,0);
 assert.equal(writes.length,0);
 assert.equal(closed,1);
});

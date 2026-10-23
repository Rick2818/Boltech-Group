import test from 'node:test';import assert from 'node:assert/strict';
import {runInboundSalesCycle} from '../lib/agent1_autonomous_inbox.js';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'};
const reply={id:'gmail-1',threadId:'thread-1',from:'buyer@example.org',subject:'Pricing information',text:'What is your price?',rfcMessageId:'<gmail-1@example.org>',receivedAt:'2026-10-21T15:00:00Z',sent:false,automatic:false};
function fake({duplicate=false,unsubscribe=false}={}){
 const sent=[],writes=[];let calls=0;
 const gmail={verify:async()=>({verified:true}),search:async()=>[{id:'gmail-1'}],message:async()=>({...reply,text:unsubscribe?'unsubscribe':reply.text}),thread:async()=>[{id:'original',sent:true,from:'ricardo.boltechgroup@gmail.com',to:reply.from,receivedAt:'2026-10-20T15:00:00Z'}, {...reply,text:unsubscribe?'unsubscribe':reply.text}],send:async j=>{assert.ok(j.rfcMessageId);sent.push(j);return {messageId:'sent-1',threadId:j.threadId}}};
 const fetcher=async(url,opts={})=>{
  const s=String(url);
  if(s.includes('/agent_work?'))return new Response('[]');
  if(s.includes('/leads?'))return new Response(JSON.stringify([{id:'lead-1',contact_email:'buyer@example.org',status:'CONTACTED',data_quality:'REAL'}]));
  if(s.includes('/agent1_inbound_sales_jobs?on_conflict')){calls++;writes.push(JSON.parse(opts.body));return new Response(JSON.stringify(duplicate?[]:[{message_id:'gmail-1'}]),{status:201});}
  if(opts.method==='PATCH')return new Response(null,{status:204});
  throw Error('UNEXPECTED_DB_REQUEST '+s);
 };
 return {gmail,fetcher,sent,writes,get calls(){return calls;}};
}
test('real contacted prospect pricing reply is sent and recorded once',async()=>{
 const x=fake();const r=await runInboundSalesCycle({gmail:x.gmail,env,fetcher:x.fetcher});assert.equal(r.replied,1);assert.equal(x.sent.length,1);assert.match(x.sent[0].text,/USD 990/);assert.equal(x.calls,1);assert.equal(r.paymentRecorded,false);
});
test('duplicate message does not send twice',async()=>{const x=fake({duplicate:true});const r=await runInboundSalesCycle({gmail:x.gmail,env,fetcher:x.fetcher});assert.equal(r.duplicate,1);assert.equal(x.sent.length,0);});
test('opt out is held and never responded to',async()=>{const x=fake({unsubscribe:true});const r=await runInboundSalesCycle({gmail:x.gmail,env,fetcher:x.fetcher});assert.equal(r.replied,0);assert.equal(x.sent.length,0);});
test('broken configuration fails closed without external reads',async()=>{const x=fake();await assert.rejects(runInboundSalesCycle({gmail:x.gmail,env:{},fetcher:x.fetcher}),/CONFIG|UNAVAILABLE/);assert.equal(x.calls,0);});
test('canonical campaign receives company and market fields from the shared CRM read',async()=>{
 const x=fake();let invoked=false;
 const fetcher=async(url,opts)=>{if(String(url).includes('/leads?')){assert.match(String(url),/name,company_url,country/);}return x.fetcher(url,opts);};
 const result=await runInboundSalesCycle({gmail:x.gmail,env,fetcher,outreach:async({leads,db,gmail})=>{invoked=true;assert.equal(leads[0].id,'lead-1');assert.equal(typeof db,'function');assert.equal(gmail,x.gmail);return {sent:0,errors:[]};}});
 assert.equal(invoked,true);assert.equal(result.campaign.sent,0);
});

test('inbox search restricts Gmail reads to canonical contacts',async()=>{
 const x=fake();const original=x.gmail.search;const queries=[];
 x.gmail.search=async q=>{queries.push(q);return original(q);};
 await runInboundSalesCycle({gmail:x.gmail,env,fetcher:x.fetcher});
 assert.ok(queries.some(q=>q.includes('{from:buyer@example.org}')));
});
test('persistent quota backoff skips Gmail then permits a recovered cycle',async()=>{
 const x=fake();let receipt=null,calls=0;const now=new Date('2026-10-22T15:00:00Z');
 const fetcher=async(url,opts={})=>{
  if(String(url).includes('/agent_work?')){
   if(opts.method==='POST'){receipt=JSON.parse(opts.body)[0].execution_receipt;return new Response(null,{status:204});}
   return Response.json(receipt?[{execution_receipt:receipt}]:[]);
  }return x.fetcher(url,opts);
 };
 x.gmail.verify=async()=>{calls++;throw Object.assign(Error('GMAIL_RATE_LIMITED'),{code:'GMAIL_RATE_LIMITED',diagnostic:{stage:'MESSAGE_READ',httpStatus:403,reason:'rateLimitExceeded'}});};
 await assert.rejects(runInboundSalesCycle({gmail:x.gmail,env,fetcher,now}),/GMAIL_RATE_LIMITED/);
 assert.equal(receipt.failures,1);assert.equal(receipt.retryAt,'2026-10-22T15:01:00.000Z');
 const held=await runInboundSalesCycle({gmail:x.gmail,env,fetcher,now});assert.equal(held.status,'GMAIL_QUOTA_BACKOFF');assert.equal(calls,1);
 x.gmail.verify=async()=>{calls++;return {verified:true};};
 await runInboundSalesCycle({gmail:x.gmail,env,fetcher,now:new Date('2026-10-22T15:02:00Z')});
 assert.equal(calls,2);assert.equal(receipt.failures,0);assert.ok(receipt.recoveredAt);
});
test('durable scan cursor reaches later senders despite a full first sender chunk',async()=>{
 const leads=Array.from({length:41},(_,i)=>({id:'lead-'+i,contact_email:'buyer'+i+'@example.org',status:'NEW',data_quality:'REAL'}));
 let receipt=null;const reads=[];
 const fetcher=async(url,opts={})=>{
  if(String(url).includes('/leads?'))return Response.json(leads);
  if(String(url).includes('/agent_work?')){
   if(opts.method==='POST'){receipt=JSON.parse(opts.body)[0].execution_receipt;return new Response(null,{status:204});}
   return Response.json(receipt?[{execution_receipt:receipt}]:[]);
  }throw Error('UNEXPECTED_DB');
 };
 const gmail={verify:async()=>({verified:true}),search:async q=>q.includes('from:buyer40@')?[{id:'zz-new'}]:Array.from({length:100},(_,i)=>({id:String(i).padStart(4,'0')})),message:async id=>{reads.push(id);return {id,sent:true};}};
 const args={gmail,env,fetcher,outreach:async()=>({errors:[]})};
 await runInboundSalesCycle(args);assert.equal(reads.length,100);assert.ok(!reads.includes('zz-new'));assert.equal(receipt.scanCursor,'0099');
 await runInboundSalesCycle(args);assert.equal(reads[100],'zz-new');assert.equal(reads.length,200);
});

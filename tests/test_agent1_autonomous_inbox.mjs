import test from 'node:test';import assert from 'node:assert/strict';
import {runInboundSalesCycle} from '../lib/agent1_autonomous_inbox.js';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'};
const reply={id:'gmail-1',threadId:'thread-1',from:'buyer@example.org',subject:'Pricing information',text:'What is your price?',rfcMessageId:'<gmail-1@example.org>',receivedAt:'2026-10-21T15:00:00Z',sent:false,automatic:false};
function fake({duplicate=false,unsubscribe=false}={}){
 const sent=[],writes=[],work=new Map(),briefs=new Map();let calls=0;
 const gmail={verify:async()=>({verified:true}),search:async()=>[{id:'gmail-1'}],message:async id=>id==='sent-1'?{id,threadId:reply.threadId,from:'ricardo.boltechgroup@gmail.com',to:reply.from,text:sent[0].text,sent:true,receivedAt:new Date().toISOString()}:{...reply,text:unsubscribe?'unsubscribe':reply.text},thread:async()=>[{id:'original',sent:true,from:'ricardo.boltechgroup@gmail.com',to:reply.from,receivedAt:'2026-10-20T15:00:00Z'}, {...reply,text:unsubscribe?'unsubscribe':reply.text}],send:async j=>{assert.ok(j.rfcMessageId);sent.push(j);return {messageId:'sent-1',threadId:j.threadId}}};
 const fetcher=async(url,opts={})=>{
  const s=String(url),u=new URL(s);
  if(u.pathname.endsWith('/agent_work')){
   if(opts.method==='POST'){for(const row of JSON.parse(opts.body))if(!work.has(row.work_id))work.set(row.work_id,row);return new Response(null,{status:204});}
   const key=u.searchParams.get('work_id');
   if(key?.startsWith('eq.')){const row=work.get(key.slice(3));if(!row)return new Response('[]');if(opts.method==='PATCH'){const f=u.searchParams.get('execution_run_id');if(f&&(f==='is.null'?row.execution_run_id!=null:row.execution_run_id!==f.slice(3)))return new Response('[]');Object.assign(row,JSON.parse(opts.body));}return new Response(JSON.stringify([row]));}
   return new Response(JSON.stringify([...work.values()]));
  }
  if(u.pathname.endsWith('/marketing_sales_briefs')){if(opts.method==='POST'){for(const row of JSON.parse(opts.body))briefs.set(row.id,row);return new Response(null,{status:204});}return new Response(JSON.stringify([...briefs.values()]));}
  if(s.includes('/agent1_inbound_sales_jobs?select='))return new Response(JSON.stringify(writes.flat()));
  if(s.includes('/leads?'))return new Response(JSON.stringify([{id:'lead-1',country:'US',name:'Buyer company',contact_email:'buyer@example.org',status:'CONTACTED',data_quality:'REAL'}]));
  if(s.includes('/agent1_inbound_sales_jobs?on_conflict')){calls++;writes.push(JSON.parse(opts.body));return new Response(JSON.stringify(duplicate?[]:[{message_id:'gmail-1'}]),{status:201});}
  if(opts.method==='PATCH')return new Response(null,{status:204});
  throw Error('UNEXPECTED_DB_REQUEST '+s);
 };
 return {gmail,fetcher,sent,writes,work,briefs,get calls(){return calls;}};
}
test('real contacted prospect pricing reply is sent and recorded once',async()=>{
 const x=fake();const r=await runInboundSalesCycle({gmail:x.gmail,env,fetcher:x.fetcher});assert.equal(r.replied,1);assert.equal(x.sent.length,1);assert.match(x.sent[0].text,/USD 990/);assert.equal(x.calls,1);assert.equal(r.paymentRecorded,false);assert.equal(r.marketing.metrics.used,1);assert.ok([...x.work.values()].some(w=>w.execution_receipt.marketingUse?.messageId==='sent-1'));
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

import test from 'node:test';import assert from 'node:assert/strict';
import {runInboundSalesCycle} from '../lib/agent1_autonomous_inbox.js';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'};
const reply={id:'gmail-1',threadId:'thread-1',from:'buyer@example.org',subject:'Pricing information',text:'What is your price?',rfcMessageId:'<gmail-1@example.org>',sent:false,automatic:false};
function fake({duplicate=false,unsubscribe=false}={}){
 const sent=[],writes=[];let calls=0;
 const gmail={verify:async()=>({verified:true}),search:async()=>[{id:'gmail-1'}],message:async()=>({...reply,text:unsubscribe?'unsubscribe':reply.text}),send:async j=>{sent.push(j);return {messageId:'sent-1',threadId:j.threadId}}};
 const fetcher=async(url,opts={})=>{
  const s=String(url);
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

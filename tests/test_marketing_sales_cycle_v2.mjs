import test from 'node:test';import assert from 'node:assert/strict';
import {runMarketingSalesCycle} from '../lib/marketing_sales_cycle_v2.js';
test('persists recommendation to Supabase and verifies receipt without sending',async()=>{
 const calls=[];const fetcher=async(url,opts={})=>{calls.push({url:String(url),opts});if(String(url).includes('/leads?'))return new Response(JSON.stringify([{country:'US',data_quality:'REAL',problem_confirmed:false},{country:'El Salvador',data_quality:'REAL'}]));if((opts.method||'GET')==='POST')return new Response(null,{status:204});return new Response(JSON.stringify([{id:'managed-ai-operations-v2-us-b2b',status:'READY_FOR_SALES_REVIEW',source_leads:1,strategy_version:'2026-10-20-v2'}]));};
 const result=await runMarketingSalesCycle({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'},fetcher});assert.equal(result.sourceLeads,1);assert.equal(result.send,false);assert.equal(calls.filter(c=>c.opts.method==='POST').length,1);assert.match(calls.find(c=>c.opts.method==='POST').opts.body,/READY_FOR_SALES_REVIEW/);
});
test('rejects malformed secrets before network',async()=>{await assert.rejects(runMarketingSalesCycle({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'bad—key'},fetcher:()=>{throw Error('NETWORK_CALLED')}}),/INVALID_SERVICE_KEY/);});

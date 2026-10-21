import test from 'node:test';
import assert from 'node:assert/strict';
import {runMarketingSalesCycle} from '../lib/marketing_sales_cycle_v2.js';
import {MARKETING_PLAYBOOK} from '../lib/marketing_commercial_playbook.js';
test('marketing executor persists problem-first asset and sales handoff without sending',async()=>{
 let saved;
 const fetcher=async (url,opts={})=>{
  if(url.includes('/leads?'))return {ok:true,text:async()=>JSON.stringify([{id:'real1',country:'US',data_quality:'UNVERIFIED',problem_confirmed:false}])};
  if(opts.method==='POST'){saved=JSON.parse(opts.body)[0];return {ok:true,text:async()=>''};}
  if(url.includes('/marketing_sales_briefs?'))return {ok:true,text:async()=>JSON.stringify([{id:saved.id,status:saved.status,source_leads:saved.source_leads,strategy_version:saved.strategy_version}])};
  throw Error('unexpected '+url);
 };
 const result=await runMarketingSalesCycle({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'safe'},fetcher});
 assert.equal(result.send,false);assert.equal(result.published,false);
 assert.equal(saved.sales_owner,'AGENT_1');assert.equal(saved.owner,'MARKETING');
 assert.equal(saved.evidence.playbook_version,MARKETING_PLAYBOOK.version);
 assert.ok(saved.evidence.asset_id);assert.ok(saved.evidence.cta);
 assert.equal(saved.evidence.provider_publication_receipt,null);
 assert.equal(saved.evidence.autonomous_send,false);
 assert.ok(MARKETING_PLAYBOOK.problemMessages.some(a=>saved.message.includes(a.pain)));
});

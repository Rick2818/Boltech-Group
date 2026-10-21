import test from 'node:test';import assert from 'node:assert/strict';
import {syncHotLeads} from '../lib/explee_hot_leads_sync.js';
const env={EXPLEE_API_KEY:'mock-not-a-secret',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock'};
test('hot lead import is read-only and saves cursor after persisting contact',async()=>{
 const calls=[];
 const fetcher=async(url,opts={})=>{
  const u=String(url);calls.push({u,method:opts.method||'GET',body:opts.body});
  if(u.includes('explee_hot_leads_cursor')&&(opts.method||'GET')==='GET')return new Response('[]',{status:200});
  if(u.includes('/autogtm/campaigns?'))return new Response(JSON.stringify({campaigns:[{id:13,project_id:50656}]}));
  if(u.includes('/autogtm/hot-leads'))return new Response(JSON.stringify({leads:[{person_id:'person1',campaign_id:13,email:'buyer@example.com',why_hot:'Interested',became_hot_at:'2026-10-20T14:00:00Z'}],has_more:false,next_offset:null}));
  return new Response(null,{status:204});
 };
 const result=await syncHotLeads({env,fetcher});
 assert.equal(result.fetched,1);
 assert.equal(result.projectId,50656);
 assert.ok(calls.some(x=>x.u.endsWith('/autogtm/campaigns?project_id=50656')));
 assert.ok(calls[0].u.includes('project_id=eq.50656'));
 const persisted=JSON.parse(calls.find(x=>x.method==='POST'&&!x.u.includes('cursor')).body);
 assert.equal(persisted[0].project_id,50656);
 assert.equal(calls.filter(x=>x.method==='POST').length,2);
 assert.ok(calls.at(-1).u.includes('cursor'));
 assert.ok(calls.every(x=>!x.u.includes('/start')&&!x.u.includes('/reply')));
});
test('missing secrets block all API traffic',async()=>{
 await assert.rejects(syncHotLeads({env:{},fetcher:()=>{throw Error('unexpected network')}}),/SECRETS_MISSING/);
});

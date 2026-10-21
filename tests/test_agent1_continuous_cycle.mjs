import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent1Cycle} from '../lib/agent1_continuous_cycle.js';
import {discoverExpleeResearch,verifyPublishedCandidate,researchOfficialContact,readOfficialPage} from '../lib/agent1_continuous_research.js';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'};
const candidate=i=>({id:'lead-'+i,name:'Company '+i,company_url:'https://company'+i+'.com',country:'US',status:'NEW',contact_email:'owner@company'+i+'.com',source_evidence_url:'https://company'+i+'.com/contact',source_payload:{research:{contactName:'Jane Doe',contactRole:'President'},verification:{humanVerified:true}}});
function database(initial=[]){
 const leads=structuredClone(initial),works=[],receipts=[];
 const fetcher=async(raw,opts={})=>{
  const u=new URL(raw),table=u.pathname.split('/').at(-1),method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):null;
  const rows=table==='leads'?leads:table==='agent_work'?works:receipts;
  const matches=row=>[...u.searchParams].every(([key,value])=>['select','order','limit','offset','on_conflict'].includes(key)||value==='is.null'?(value==='is.null'?row[key]==null:true):value.startsWith('eq.')?String(row[key])===value.slice(3):true);
  let found=rows.filter(matches);
  if(method==='POST'){
   found=[];for(const row of body){const key=table==='leads'?'id':table==='agent_work'?'work_id':'cycle_key';let existing=rows.find(x=>x[key]===row[key]);if(!existing){existing={id:'work-'+rows.length,execution_run_id:null,...row};rows.push(existing);found.push(existing);}else if(!opts.headers?.Prefer?.includes('ignore-duplicates')){Object.assign(existing,row);found.push(existing);}}
  }else if(method==='PATCH'){for(const row of found)Object.assign(row,body);}
  if(opts.headers?.Prefer?.includes('return=minimal'))return new Response(null,{status:204});
  if(method==='GET'&&table==='leads'){const offset=Number(u.searchParams.get('offset')||0);found=found.slice(offset,offset+Number(u.searchParams.get('limit')||1000));}
  return Response.json(found);
 };
 return {fetcher,leads,works,receipts};
}
const empty=async({cursor=0})=>({status:'EMPTY',candidates:[],nextCursor:cursor+1});
const verify=async lead=>({status:'PREPARED_PENDING_HISTORY_CHECK',verification:{...lead.source_payload.verification,mxVerified:true},draft:{subject:'QA',body:'QA',sent:false}});
test('research tasks never inflate followup count and prepared totals reflect saved rows',async()=>{
 const db=database([{...candidate(1),next_action:'Research contact'}, {...candidate(2),status:'CONTACTED',source_payload:{gmail_sent_message_id:'provider-id'}},{...candidate(3),status:'CONTACTED',commercial_stage:'REPLIED',source_payload:{gmail_sent_message_id:'replied-id'}}]);
 const r=await runAgent1Cycle({env,fetcher:db.fetcher,discoverExplee:empty,discoverPublic:empty,verifyCandidate:verify});assert.equal(r.followups_pending,1);assert.equal(r.preparedTotal,1);assert.equal(r.researchPending,0);
});
test('research persists and prepares more than five; resumes source cursor and deduplicates',async()=>{
 const db=database();const cursors=[];
 const discover=async({cursor})=>{cursors.push(cursor);return {status:'FOUND',candidates:Array.from({length:17},(_,i)=>candidate(i)),nextCursor:cursor+1}};
 const run=now=>runAgent1Cycle({env,fetcher:db.fetcher,now:new Date(now),discoverExplee:discover,discoverPublic:empty,verifyCandidate:verify});
 const a=await run('2026-10-21T01:00:00Z');assert.equal(a.discovered,17);assert.equal(a.prepared,17);assert.equal(a.researchTotalLimit,null);assert.equal(a.outreachSent,0);
 const b=await run('2026-10-21T01:10:00Z');assert.equal(b.discovered,0);assert.equal(b.duplicates,17);assert.equal(db.leads.length,17);assert.deepEqual(cursors,[0,1]);assert.equal(db.works[0].execution_receipt.expleeCursor,2);assert.equal(db.receipts.length,2);
});
test('quota/source failure preserves independent research and queued verification',async()=>{
 const db=database([candidate(0)]);
 const x=await runAgent1Cycle({env,fetcher:db.fetcher,discoverExplee:async({cursor})=>({status:'EXPLEE_HTTP_429',candidates:[],nextCursor:cursor,retryAt:'2026-10-22T01:00:00Z'}),discoverPublic:async()=>({status:'PUBLIC',candidates:[{id:'signal',name:'Need help',source:'PUBLIC',status:'NEW',source_payload:{research:{buyerVerified:false}}}],nextCursor:1}),verifyCandidate:verify});
 assert.equal(x.discovered,1);assert.equal(x.prepared,1);assert.equal(db.leads[1].source_payload.research.buyerVerified,false);assert.equal(db.works[0].execution_receipt.expleeCursor,0);
});
test('active lease blocks overlapping work including identical scheduler time',async()=>{
 const db=database();db.works.push({work_id:'agent1-continuous-prospecting',updated_at:'2026-10-21T01:00:00Z',execution_run_id:'other',execution_receipt:{leaseUntil:'2026-10-21T01:04:00Z'}});
 let called=false;const x=await runAgent1Cycle({env,fetcher:db.fetcher,now:new Date('2026-10-21T01:00:00Z'),discoverExplee:async()=>{called=true;}});assert.equal(x.status,'BUSY');assert.equal(called,false);
});
test('Explee always uses documented free result zone, no billable pagination or enrichment',async()=>{
 const bodies=[];const x=await discoverExpleeResearch({env:{EXPLEE_API_KEY:'test'},cursor:73,fetcher:async(url,opts)=>{assert.equal(url,'https://api.explee.com/public/api/v1/search/people');assert.equal(opts.headers['X-API-Key'],'test');bodies.push(JSON.parse(opts.body));return Response.json({people:[],meta:{credits_charged:0,remaining_balance:1}});}});
 assert.equal(x.nextCursor,74);assert.equal(bodies[0].page,1);assert.equal(bodies[0].page_size,10);assert.equal(bodies[0].exclude_lists,undefined);assert.equal(bodies[0].people_filters.criteria,undefined);assert.match(bodies[0].company_filters.geo_subdivision[0],/^US-[A-Z]{2}$/);
});
test('unknown MX never becomes prepared and real evidence does not manufacture human review',async()=>{
 const p=candidate(1);p.source_payload.verification.humanVerified=false;
 const pageReader=async()=>'<html>Jane Doe President owner@company1.com Request a quote</html>';
 const no=await verifyPublishedCandidate(p,{pageReader,mxResolver:async()=>[]});assert.equal(no.draft,null);assert.equal(no.verification.mxVerified,false);
 const yes=await verifyPublishedCandidate(p,{pageReader,mxResolver:async()=>[{exchange:'mx.company1.com',priority:0}]});assert.equal(yes.status,'PREPARED_PENDING_EVIDENCE_REVIEW');assert.equal(yes.verification.humanVerified,false);assert.equal(yes.draft.sent,false);
});
test('official extraction requires one explicitly published email beside name and role',async()=>{
 const p=candidate(1);delete p.contact_email;
 const found=await researchOfficialContact(p,{pageReader:async()=>'<html>Jane Doe President owner@company1.com</html>'});assert.equal(found.contact_email,'owner@company1.com');assert.equal(found.source_payload.verification.officialNameRoleEmailLocated,true);
 const ambiguous=await researchOfficialContact(p,{pageReader:async()=>'<html>Jane Doe President jane@company1.com support@company1.com</html>'});assert.equal(ambiguous.contact_email,undefined);
});
test('official source loader rejects private DNS and cross-host redirects',async()=>{
 let called=false;await assert.rejects(readOfficialPage('https://internal.example.com',{resolveAddresses:async()=>['127.0.0.1'],fetcher:async()=>{called=true;}}),/PUBLIC_SOURCE_ADDRESS/);assert.equal(called,false);
 await assert.rejects(readOfficialPage('https://public.example.com',{resolveAddresses:async()=>['93.184.216.34'],fetcher:async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1'}})}),/SOURCE_HTTP_302/);
});
test('runtime budget checkpoints remaining candidates for the next run without a batch target',async()=>{
 const db=database(Array.from({length:12},(_,i)=>candidate(i)));let time=0;
 const check=async p=>{time+=10;return verify(p)};
 const a=await runAgent1Cycle({env,fetcher:db.fetcher,now:new Date('2026-10-21T01:00:00Z'),clock:()=>time,budgetMs:30,discoverExplee:empty,discoverPublic:empty,verifyCandidate:check});assert.equal(a.prepared,3);
 time=0;const b=await runAgent1Cycle({env,fetcher:db.fetcher,now:new Date('2026-10-21T01:10:00Z'),clock:()=>time,budgetMs:300,discoverExplee:empty,discoverPublic:empty,verifyCandidate:check});assert.equal(b.prepared,9);assert.equal(db.leads.filter(x=>x.source_payload.campaignDraft).length,12);
});
test('real published quoting and contact forms produce specific drafts without claiming confirmed pain',async()=>{
 const p=candidate(1);p.source_payload.verification={humanVerified:false,officialSourceReviewed:true};const mxResolver=async()=>[{exchange:'mx.company1.com',priority:0}];
 const a=await verifyPublishedCandidate(p,{mxResolver,pageReader:async()=>'<html>Jane Doe President owner@company1.com For quotes or quoting contact us</html>'});assert.equal(a.status,'PREPARED_PENDING_HISTORY_CHECK');assert.match(a.draft.body,/quote request process/);
 const b=await verifyPublishedCandidate(p,{mxResolver,pageReader:async()=>'<html><img alt="Jane Doe, President">owner@company1.com Contact us<form><input name="project"></form></html>'});assert.equal(b.verification.namedContactPublished,true);assert.equal(b.verification.publishedWorkflow,'CONTACT_REQUEST');assert.match(b.draft.body,/project inquiry form/);assert.doesNotMatch(b.draft.body,/quote request process/);assert.equal(b.verification.humanVerified,false);
});

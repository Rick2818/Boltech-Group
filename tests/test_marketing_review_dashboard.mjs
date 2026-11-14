import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readMarketingReview,handleMarketingReview} from '../lib/marketing_review_dashboard.js';

const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'qa-test-only'};
const baseReceipt={source:'UPWORK',sourceId:'UPWORK-2116710960048985715',marketingContentId:'marketing-v4-platform-UPWORK-2116710960048985715',proposalStatus:'NOT_SUBMITTED'};
const work=[{work_id:'AGENT1:MARKETPLACE:'+baseReceipt.sourceId,status:'PENDING',execution_state:'MARKETING_DRAFT_READY_FOR_REVIEW',execution_receipt:baseReceipt}];
const assets=[
 {id:baseReceipt.marketingContentId,channel:'MARKETPLACE_PROPOSAL_DRAFT',subject:'Internal proposal - CRM',body:'We will assess CRM workflow.',created_at:'2026-11-01T04:04:19Z',distribution_status:'REVIEW_REQUIRED',
  evidence:{platform:'UPWORK',sourceId:baseReceipt.sourceId,sourceUrl:'https://www.upwork.com/jobs/~022116710960048985715',workId:'AGENT1:MARKETPLACE:'+baseReceipt.sourceId,opportunityTitle:'CRM integration',proposalStatus:'NOT_SUBMITTED'}},
 {id:'marketing-v4-platform-UPWORK-999',channel:'MARKETPLACE_PROPOSAL_DRAFT',subject:'Spoofed',body:'Do not show',created_at:'2026-11-01T04:04:19Z',distribution_status:'REVIEW_REQUIRED',
  evidence:{platform:'UPWORK',sourceId:'UPWORK-999',sourceUrl:'https://malicious.test/jobs/1',workId:'AGENT1:MARKETPLACE:UPWORK-999'}}
];
function store(fetcherData={assets,work}){
 const calls=[];
 return {calls,fetcher:async(url,init)=>{
  calls.push({url,method:init.method,headers:init.headers});
  const result=url.includes('/marketing_content_runs?')?fetcherData.assets:fetcherData.work;
  return {ok:true,json:async()=>result};
 }};
}
function response(){return {headers:{},code:200,body:null,setHeader(k,v){this.headers[k]=v;return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
test('reads full actual-style marketplace proposals only with validated source and Agent 1 handoff',async()=>{
 const m=store();const data=await readMarketingReview({env,fetcher:m.fetcher,now:new Date('2026-11-01T04:25:00Z')});
 assert.equal(data.localDay,'2026-10-31');
 assert.equal(data.metrics.total,1);
 assert.equal(data.metrics.createdToday,1);
 assert.equal(data.metrics.handoffsVerified,1);
 assert.equal(data.metrics.pendingReview,1);
 assert.equal(data.drafts[0].body,'We will assess CRM workflow.');
 assert.equal(data.drafts[0].proposalStatus,'NOT_SUBMITTED');
 assert.equal(data.drafts[0].sourceUrl,'https://www.upwork.com/jobs/~022116710960048985715');
 assert.ok(m.calls.every(c=>c.method==='GET'));
 assert.ok(m.calls.every(c=>c.headers.Authorization.startsWith('Bearer ')));
 assert.ok(!JSON.stringify(data).includes(env.SUPABASE_SERVICE_ROLE_KEY));
 assert.equal(data.metrics.sentMetricAvailable,false);
 assert.equal(data.sendEnabled,false);
});
test('El Salvador day boundaries distinguish new material from pending historical material',async()=>{
 const m=store();const data=await readMarketingReview({env,fetcher:m.fetcher,now:new Date('2026-11-01T07:00:00Z')});
 assert.equal(data.localDay,'2026-11-01');assert.equal(data.metrics.createdToday,0);assert.equal(data.metrics.total,1);
});
test('legacy and unknown host material never appear, even if Supabase has them',async()=>{
 const m=store({assets:[assets[0],{...assets[0],id:'marketing-old',distribution_status:'RETIRED_LEGACY'},assets[1]],work});
 const d=await readMarketingReview({env,fetcher:m.fetcher});
 assert.deepEqual(d.drafts.map(x=>x.id),[assets[0].id]);
});
test('API rejects missing session before any DB access and remains GET-only',async()=>{
 const renewals=[];const m=store(),redis={async get(){return {authorized:true}},async expire(key,seconds){renewals.push({key,seconds});return 1;}};
 const anonymous=response();
 await handleMarketingReview({method:'GET',headers:{}},anonymous,{env,fetcher:m.fetcher,redis});
 assert.equal(anonymous.code,401);assert.equal(m.calls.length,0);
 const invalidMethod=response();
 await handleMarketingReview({method:'POST',headers:{}},invalidMethod,{env,fetcher:m.fetcher,redis});
 assert.equal(invalidMethod.code,405);assert.equal(m.calls.length,0);
 const valid=response();
 await handleMarketingReview({method:'GET',headers:{cookie:'__Host-boltech-marketing='+'a'.repeat(64)}},valid,{env,fetcher:m.fetcher,redis});
 assert.equal(valid.code,200);assert.equal(valid.body.metrics.total,1);
 assert.equal(renewals.length,1);
 assert.equal(renewals[0].seconds,30*24*3600);
 assert.match(valid.headers['Set-Cookie'],/HttpOnly; SameSite=Lax; Max-Age=2592000/);
 assert.match(valid.headers['Cache-Control'],/no-store/);
});
test('review page uses code login, no technical token, and cockpit targets working file',()=>{
 const page=readFileSync(new URL('../marketing-review.html',import.meta.url),'utf8');
 const cockpit=readFileSync(new URL('../COCKPIT_EJECUTIVO_RICARDO.html',import.meta.url),'utf8');
 const routing=readFileSync(new URL('../vercel.json',import.meta.url),'utf8');
 const handler=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(cockpit,/href="\/marketing-review.html"/);
 assert.match(page,/api\/marketing-login/);
 assert.match(page,/api\/marketing-review/);
 assert.match(page,/Enviar código a mi correo/);
 assert.doesNotMatch(page,/localStorage|sessionStorage|Pega tu token|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(page,/textContent/);
 assert.match(routing,/marketing_login=1/);
 assert.match(handler,/BOLTECH_LEO_WOMPI_ONLY/);
 assert.doesNotMatch(handler,/handleMarketingLogin/);
});

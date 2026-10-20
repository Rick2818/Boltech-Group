import test from 'node:test';
import assert from 'node:assert/strict';
import { createSdrDispatch, validateSdrCandidate, sdrWindow, dailyCampaignSendDays } from '../lib/sdr_dispatch.js';
import {createAgent1SalesExecutor} from '../lib/agent1_sales_skills.js';
import { createSdrGmail } from '../lib/sdr_gmail.js';
const instant = new Date('2026-10-07T15:05:00Z');
const candidate = () => ({status:'READY_FOR_CONTACT',contactEligible:true,recordId:'recVerified123',email:'business@example.com',subject:'A specific process question',commercialResearch:{accountKey:'example.com',channelVerified:true,observation:'A public intake form',hypothesis:'Routing may be manual',sources:['https://example.com/contact'],individualMessage:'Who owns this process? Reply no to stop.',salesReview:{accepted:true,reviewedBy:'Sales',reviewedAt:instant.toISOString()},history:{checkedAt:instant.toISOString(),gmail:'CLEAR',apollo:'CLEAR',crm:'CLEAR',suppression:'CLEAR'}}});
function setup({unknown=false,crmFailure=false,notes=''}={}) {
  const data = new Map(), jobs = new Set(); let sends=0, patchCount=0;
  const command=async ([op,k,v,...rest]) => {if(op==='GET')return data.get(k)||null;if(op==='SET'){if(rest.includes('NX')&&data.has(k))return null;data.set(k,v);return 'OK';}if(op==='ZCOUNT')return 0;if(op==='ZADD'){jobs.add(rest[0]);return 1;}if(op==='ZRANGE')return [...jobs];if(op==='EVAL'){data.delete('boltech:sdr:mailbox-lease');return 1;}throw Error(op);};
  const gmail={verify:async()=>({verified:true}),search:async q=>q.includes('rfc822')?[{id:'provider123',threadId:'thread123'}]:[],send:async()=>{sends++;assert.ok([...data.values()].some(x=>x.includes('SEND_PENDING')));if(unknown)throw Object.assign(Error('timeout'),{code:'GMAIL_SEND_UNKNOWN'});return {messageId:'provider123',threadId:'thread123'};}};
  const fetcher=async(u,o)=>{if(o.method==='PATCH'&&++patchCount>1&&crmFailure)throw Error('crm offline');return {ok:true,json:async()=>({fields:{'Contact Email':'business@example.com',Notes:notes}})};};
  const worker=createSdrDispatch({command,gmail,fetcher,now:()=>instant,env:{AIRTABLE_TOKEN:'test'}});
  return {worker,sends:()=>sends};
}
test('blocks directory readiness, stale history and weekends',()=>{
  assert.throws(()=>validateSdrCandidate({...candidate(),status:'RESEARCH_REQUIRED'},instant),/NOT_APPROVED/);
  const p=candidate();p.commercialResearch.history.checkedAt='2026-10-06T15:00:00Z';assert.throws(()=>validateSdrCandidate(p,instant),/NOT_CURRENT/);
  assert.equal(sdrWindow(new Date('2026-10-10T15:00:00Z')).allowed,false);assert.equal(sdrWindow(new Date('2026-10-07T14:59:00Z')).allowed,false);
});
test('persists pending before send and does not repeat an initial',async()=>{
  const s=setup();const first=await s.worker.run(candidate());assert.equal(first.job.state,'SENT');assert.equal(first.job.messageId,'provider123');assert.equal(first.job.crmState,'SYNCED');assert.equal((await s.worker.run(candidate())).attempted,false);assert.equal(s.sends(),1);
});
test('ambiguous send stays UNKNOWN until exact provider reconciliation; never retries',async()=>{
  const s=setup({unknown:true});const first=await s.worker.run(candidate());assert.equal(first.job.state,'UNKNOWN');await s.worker.run(candidate());assert.equal(s.sends(),1);const r=await s.worker.reconcile(first.job.id);assert.equal(r.state,'SENT');assert.equal(r.sentAt,null);assert.equal(s.sends(),1);
});
test('CRM post-send failure retains receipt and cannot cause resend',async()=>{
  const s=setup({crmFailure:true});const r=await s.worker.run(candidate());assert.equal(r.job.state,'SENT');assert.equal(r.job.crmState,'SYNC_PENDING');await s.worker.run(candidate());assert.equal(s.sends(),1);
});
test('wrong Google account cannot send as commercial sender',async()=>{
  const env={GMAIL_OAUTH_CLIENT_ID:'test',GMAIL_OAUTH_CLIENT_SECRET:'test',GMAIL_OAUTH_REFRESH_TOKEN:'test'};
  const gmail=createSdrGmail(async u=>({ok:true,json:async()=>u.includes('oauth2')?{access_token:'test',expires_in:3600}:{emailAddress:'other@example.com'}}),env);
  await assert.rejects(gmail.verify(),/SENDER_MISMATCH/);
});
test('daily campaign calendar admits Sunday at 09:00 SV while preserving time and legacy weekday boundaries',()=>{
 const daily=[0,1,2,3,4,5,6];
 assert.equal(sdrWindow(new Date('2026-10-18T15:00:00Z'),daily).allowed,true);
 assert.equal(sdrWindow(new Date('2026-10-18T14:59:59Z'),daily).allowed,false);
 assert.equal(sdrWindow(new Date('2026-10-18T23:00:00Z'),daily).allowed,false);
 assert.equal(sdrWindow(new Date('2026-10-18T15:00:00Z')).allowed,false);
});

test('weekend exception expires after the specifically authorized Salvador date',()=>{
 for(const iso of ['2026-10-24T15:00:00Z','2026-10-25T15:00:00Z'])assert.equal(sdrWindow(new Date(iso),dailyCampaignSendDays(new Date(iso))).allowed,false);
 const date=new Date('2026-10-18T15:00:00Z');assert.equal(sdrWindow(date,dailyCampaignSendDays(date)).allowed,true);
 const weekday=new Date('2026-10-19T15:00:00Z');assert.equal(sdrWindow(weekday,dailyCampaignSendDays(weekday)).allowed,true);
});

test('skills-prepared BANT unknown reaches guarded sender, while external UNKNOWN hold still blocks',async()=>{
 const prepared=createAgent1SalesExecutor().prepare({lead:{fields:{Name:'Fixture business','Contact Email':'business@example.com','Company URL':'https://example.com'}},research:{state:'PUBLIC_WEBSITE_OBSERVED',operationalSignals:[{type:'RFQ',sourceUrl:'https://example.com/rfq'}],contactEvidence:[{email:'business@example.com',basis:'OFFICIAL_PUBLICATION',url:'https://example.com/contact'}]},history:{gmail:'CLEAR',apollo:'CLEAR',crm:'CLEAR',suppression:'CLEAR'},mx:{mx:true},at:instant.toISOString()});
 const p=candidate();p.subject=prepared.subject;Object.assign(p.commercialResearch,{individualMessage:prepared.individualMessage,qualification:prepared.qualification,skills:prepared.skills});
 const packet=`[SDR_CANDIDATE_V1]${JSON.stringify(p)}[/SDR_CANDIDATE_V1]`;
 const s=setup({notes:packet});assert.equal((await s.worker.run(p)).job.state,'SENT');assert.equal(s.sends(),1);await s.worker.run(p);assert.equal(s.sends(),1);
 const held=setup({notes:'Prior send outcome UNKNOWN; reconcile first.\n'+packet});await assert.rejects(held.worker.run(p),e=>e.code==='SDR_CRM_CONTACT_HOLD');assert.equal(held.sends(),0);
});

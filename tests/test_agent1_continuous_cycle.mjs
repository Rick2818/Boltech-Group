import test from 'node:test';import assert from 'node:assert/strict';
import {releaseVerifiedProspects} from '../lib/agent1_v2_five_lead_gate.js';
import {runAgent1Cycle} from '../lib/agent1_continuous_cycle.js';
const lead=i=>({company:'Company '+i,country:'US',email:'buyer'+i+'@example.org',contactName:'Person',contactRole:'Director',officialWebsite:'https://example.org',sourceUrl:'https://example.org',publishedBusinessContact:true,mxVerified:true,humanVerified:true,buyerVerified:true,suppressionStatus:'CLEAR',crmHistory:'CLEAR',gmailHistory:'CLEAR',consentOrOutreachCompliance:'CLEAR'});
test('one or 100 verified leads pass without fixed batch',()=>{assert.equal(releaseVerifiedProspects([lead(0)]).verifiedCount,1);assert.equal(releaseVerifiedProspects(Array.from({length:100},(_,i)=>lead(i))).verifiedCount,100);assert.equal(releaseVerifiedProspects([lead(0),lead(0)]).verifiedCount,1);});
test('cycle saves durable provider receipt, does not claim outbound sales',async()=>{
 const calls=[];const fetcher=async(url,opts)=>{calls.push({url:String(url),opts});if(String(url).includes('/leads?'))return new Response(JSON.stringify([{status:'CONTACTED',next_action:'follow up',data_quality:'REAL'}]));if(opts.method==='POST')return new Response(null,{status:204});return new Response(JSON.stringify([{cycle_key:'2026-10-20T14:00',result:'OBSERVED_NO_OUTREACH'}]));};
 const x=await runAgent1Cycle({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'},fetcher,now:new Date('2026-10-20T14:00:00Z')});
 assert.equal(x.contacted,1);assert.equal(x.followups_pending,1);assert.equal(x.outreachSent,0);assert.equal(calls.filter(x=>x.opts.method==='POST').length,1);
});

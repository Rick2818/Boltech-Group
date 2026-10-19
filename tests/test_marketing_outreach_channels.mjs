import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectMarketingChannels,inspectWaalaxy,inspectInstantly} from '../lib/marketing_outreach_channels.js';
test('absent credentials cause explicit blockers, no synthetic activity',async()=>{
 const result=await inspectMarketingChannels({waalaxy:{token:''},instantly:{token:''}});
 assert.equal(result.ready,false);assert.equal(result.sendingPerformed,false);
 assert.deepEqual(result.channels.map(x=>x.code),['WAALAXY_API_KEY_REQUIRED','INSTANTLY_API_KEY_REQUIRED']);
});
test('read-only tools query official endpoints using bearer auth',async()=>{
 const visits=[];
 const fetcher=async(url,options)=>{
  visits.push({url,options});
  return {ok:true,json:async()=> url.includes('prospectLists')?[{_id:'x'}]:url.includes('campaigns/getAll')?[{_id:'c'}]:url.includes('/accounts')?{items:[{email:'a@example.org'}]}:{items:[{id:'q'}]}};
 };
 const a=await inspectWaalaxy({token:'secret-test',fetcher}),b=await inspectInstantly({token:'secret-test',fetcher});
 assert.equal(a.status,'VERIFIED_READ');assert.equal(b.status,'VERIFIED_READ');assert.equal(a.prospectLists,1);assert.equal(b.senderAccounts,1);
 assert.equal(visits.length,4);
 assert.ok(visits.every(v=>v.options.method==='GET'&&v.options.headers.Authorization==='Bearer secret-test'));
});
test('provider errors stay blocked and never become execution receipts',async()=>{
 const bad=async()=>({ok:false,status:401});
 assert.equal((await inspectWaalaxy({token:'bad',fetcher:bad})).status,'BLOCKED');
 assert.equal((await inspectInstantly({token:'bad',fetcher:bad})).status,'BLOCKED');
});

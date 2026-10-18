import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('production entrypoint POST-revalidates a previously READY GET result',()=>{
 const code=`import assert from 'node:assert/strict';process.env.PARTNER_API_TOKEN='test-only';delete process.env.GITHUB_EVENT_NAME;let posts=0;globalThis.fetch=async(u,o)=>{if(o.method==='POST')posts++;return {ok:true,json:async()=>({success:true,preparation:{state:'READY',selected:Array.from({length:5},(_,i)=>({recordId:'rec'+i})),target:5,attempts:5,rejected:[]}})}};await import('./scripts/ops/prepare_five_leads.mjs');assert.equal(posts,1);`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});

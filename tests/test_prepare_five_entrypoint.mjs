import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
test('production entrypoint POST-revalidates a previously READY GET result',()=>{
 const script=pathToFileURL(resolve('scripts/ops/prepare_five_leads.mjs')).href;
 const code=`import assert from 'node:assert/strict';process.env.PARTNER_API_TOKEN='test-only';delete process.env.GITHUB_EVENT_NAME;delete process.env.GITHUB_STEP_SUMMARY;let posts=0;globalThis.fetch=async(u,o)=>{if(o.method==='POST')posts++;return {ok:true,json:async()=>({success:true,preparation:{state:'READY',selected:Array.from({length:5},(_,i)=>({recordId:'rec'+i})),target:5,attempts:5,rejected:[]}})}};await import(${JSON.stringify(script)});assert.equal(posts,1);`;
 const dir=mkdtempSync(join(tmpdir(),'boltech-prepare-qa-'));
 try{const r=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}finally{rmSync(dir,{recursive:true,force:true});}
});

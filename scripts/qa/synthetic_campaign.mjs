import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
// Start a fresh process with no provider credentials and a preload network guard.
const safeEnv=new Set(['PATH','LANG','LC_ALL','TZ','TMPDIR','TMP','TEMP']);
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>safeEnv.has(key)));
const worker=process.argv.includes('--relay-chain')?'synthetic_relay_worker.mjs':'synthetic_campaign_worker.mjs';
const args=['--require',fileURLToPath(new URL('./deny_network.cjs',import.meta.url)),fileURLToPath(new URL('./'+worker,import.meta.url)),...process.argv.slice(2)];
let result;
if(worker==='synthetic_relay_worker.mjs'){
 const caseId=process.argv[2];if(!/^QA-[a-zA-Z0-9-]{1,70}$/.test(caseId||''))throw Error('QA_CASE_INVALID');
 const root=new URL(`../../ops-output/synthetic-qa/${caseId}/`,import.meta.url);mkdirSync(root,{recursive:true});
 // Linux CI/runtime: kernel lock survives wrapper termination and is released on worker exit.
 result=spawnSync('flock',['--exclusive','--nonblock',fileURLToPath(new URL('relay.lock',root)),process.execPath,...args],{env,stdio:'inherit'});
}else result=spawnSync(process.execPath,args,{env,stdio:'inherit'});
if(result.error)console.error(result.error.message);
process.exitCode=result.status??1;

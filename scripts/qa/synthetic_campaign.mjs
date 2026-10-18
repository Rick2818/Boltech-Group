import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Start a fresh process with no provider credentials and a preload network guard.
const safeEnv=new Set(['PATH','LANG','LC_ALL','TZ','TMPDIR','TMP','TEMP']);
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>safeEnv.has(key)));
const result=spawnSync(process.execPath,['--require',fileURLToPath(new URL('./deny_network.cjs',import.meta.url)),fileURLToPath(new URL('./synthetic_campaign_worker.mjs',import.meta.url)),...process.argv.slice(2)],{env,stdio:'inherit'});
process.exitCode=result.status??1;

import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Start a fresh process with no provider credentials and a preload network guard.
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>! /TOKEN|SECRET|API_KEY|AIRTABLE|UPSTASH|REDIS|WOMPI|DATABASE_URL|PGPASSWORD|NODE_OPTIONS/i.test(key)));
const result=spawnSync(process.execPath,['--require',fileURLToPath(new URL('./deny_network.cjs',import.meta.url)),fileURLToPath(new URL('./synthetic_campaign_worker.mjs',import.meta.url)),...process.argv.slice(2)],{env,stdio:'inherit'});
process.exitCode=result.status??1;

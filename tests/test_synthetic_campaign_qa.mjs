import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const run=(id,...args)=>spawnSync(process.execPath,['scripts/qa/synthetic_campaign.mjs',id,...args],{encoding:'utf8'});
const load=id=>readFile(`ops-output/synthetic-qa/${id}/state.json`,'utf8').then(JSON.parse);
test('existing Agent 1, virtual mail, durable handoff and process restart',async()=>{
 const id='QA-'+randomUUID();const first=run(id,'--at=2026-10-18T14:30:00Z');assert.equal(first.status,0,first.stderr);
 const a=JSON.parse(first.stdout);assert.equal(a.status,'ISOLATED_QA_PASS');assert.equal(a.realEmails,0);assert.equal(a.receipts.length,4);
 const second=run(id,'--at=2026-10-19T14:30:00Z');assert.equal(second.status,0,second.stderr);const b=JSON.parse(second.stdout);assert.equal(b.reused,true);assert.deepEqual(a.receipts,b.receipts);assert.equal((await load(id)).outbox.length,1);
});
test('failure after virtual send holds UNKNOWN across another process without duplicate',async()=>{
 const id='QA-'+randomUUID();assert.notEqual(run(id,'--fault-after-send').status,0);
 const before=await load(id);assert.equal(before.outbox.length,1);assert.ok(Object.values(before.kv).some(v=>JSON.parse(v).state==='UNKNOWN'));
 assert.notEqual(run(id).status,0);assert.deepEqual((await load(id)).outbox,before.outbox);
});
test('network and subprocess escape blocked, secrets removed before imports',()=>{
 const code="const assert=require('node:assert/strict');assert.equal(process.env.PARTNER_API_TOKEN,undefined);assert.equal(process.env.SMTP_PASS,undefined);assert.equal(process.env.GMAIL_APP_PASSWORD,undefined);for(const fn of [()=>require('node:https').get('https://boltech-group.vercel.app'),()=>require('node:net').connect(443,'example.com'),()=>require('node:child_process').spawn('curl',[]),()=>require('node:dgram').createSocket('udp4'),()=>require('node:dns').lookup('example.com'),()=>require('node:dns/promises').resolveMx('example.com')])assert.throws(fn,/QA_NETWORK_DENIED/);fetch('https://example.com').then(()=>process.exitCode=1,e=>assert.equal(e.code,'QA_NETWORK_DENIED'));";
 const r=spawnSync(process.execPath,['--require','./scripts/qa/deny_network.cjs','-e',code],{env:{...process.env,PARTNER_API_TOKEN:'qa-canary',SMTP_PASS:'qa-canary',GMAIL_APP_PASSWORD:'qa-canary'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});

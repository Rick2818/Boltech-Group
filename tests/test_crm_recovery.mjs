import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrmRecovery, syncHubSpotContact, ENQUEUE_SCRIPT, FINISH_SCRIPT, normalizeContact, queueContactSync } from '../lib/crm_recovery.js';
import crm from '../api/crm.js';

function fixture(sync = async () => ({ success: true, contactId: 'provider-1' })) {
  const data = new Map(), due = new Map(), blocked = new Map(); let time = 1000;
  const command = async ([op, ...args]) => {
    if (op === 'GET') return data.get(args[0]) || null;
    if (op === 'SET') { if (data.has(args[0])) return null; data.set(args[0],args[1]); return 'OK'; }
    if (op === 'ZCARD') return args[0].endsWith(':blocked') ? blocked.size : due.size;
    if (op === 'ZRANGE') return [...blocked.keys()].slice(0, 20);
    if (op === 'ZRANGEBYSCORE') return [...due].filter(([,score]) => score <= Number(args[2])).map(([id]) => id).slice(0,1);
    if (op === 'EVAL') {
      const [script, count] = args; const keys=args.slice(2,2+count), values=args.slice(2+count);
      if (script === ENQUEUE_SCRIPT) {
        if(data.has(keys[0]))return 'EXISTS';
        data.set(keys[0],values[0]); due.set(values[2],Number(values[1])); data.set(keys[2],values[2]); return 'OK';
      }
      if (script === FINISH_SCRIPT) {
        if(data.get(keys[1])!==values[0])return 'LEASE_LOST';
        data.set(keys[0],values[1]);
        if(values[2]==='DONE')due.delete(values[3]);else due.set(values[3],Number(values[2]));
        if(values[4]==='BLOCKED')blocked.set(values[3],0);else blocked.delete(values[3]);
        data.delete(keys[1]);return 'OK';
      }
      if(data.get(keys[0])===values[0])data.delete(keys[0]);return 1;
    }
    throw new Error('Unexpected command');
  };
  return { command, store: createCrmRecovery({ command, sync, now: () => time }), advance: () => { time += 4000000; } };
}
const lead = { email: ' QA@example.com ', company: 'QA' };
test('complete requests survive restart and identical retries preserve their reference', async () => {
  const f = fixture();
  const input = { ...lead, painPoint: 'Cotizaciones incompletas', service: 'custom' };
  const first = await f.store.enqueue(input);
  const retry = await f.store.enqueue(input);
  assert.equal(first.job.id, retry.job.id);
  assert.equal(retry.created, false);
  const restarted = createCrmRecovery({ command: f.command });
  assert.deepEqual((await restarted.read(first.job.id)).request, { painPoint: input.painPoint, service: 'custom' });
  const changed = await f.store.enqueue({ ...input, painPoint: 'Otra solicitud' });
  assert.notEqual(changed.job.id, first.job.id);
  assert.equal((await restarted.read(first.job.id)).request.painPoint, input.painPoint);
});
test('contact validation and stable normalized duplicate enqueue',async()=>{
  assert.throws(()=>normalizeContact({email:'invalid'}));
  const {store}=fixture();const a=await store.enqueue(lead),b=await store.enqueue({...lead,email:'qa@example.com'});
  assert.equal(a.job.id,b.job.id);assert.equal(b.created,false);
});
test('restart preserves pending work and success requires provider evidence',async()=>{
 const f=fixture();const {job}=await f.store.enqueue(lead);
 const restarted=createCrmRecovery({command:f.command,sync:async()=>({success:true,contactId:'real-id'}),now:()=>1000});
 assert.equal((await restarted.drain())[0].state,'COMPLETED');
 assert.equal((await f.store.read(job.id)).result.contactId,'real-id');assert.deepEqual(await restarted.drain(),[]);
});
test('429/5xx retry backoff survives restart and later completes',async()=>{
 let calls=0;const f=fixture(async()=>{if(++calls===1)throw Object.assign(new Error(),{code:'HUBSPOT_RATE_LIMIT',retryable:true,retryAfterMs:120000});return {success:true,contactId:'real'};});
 const {job}=await f.store.enqueue(lead);assert.equal((await f.store.run(job.id)).state,'RETRY_PENDING');
 assert.deepEqual(await f.store.drain(),[]);f.advance();assert.equal((await f.store.drain())[0].state,'COMPLETED');
});
test('retry exhaustion blocks after five attempts and manual resume is explicit',async()=>{
 let fail=true;const f=fixture(async()=>{if(fail)throw Object.assign(new Error(),{code:'HUBSPOT_UNAVAILABLE',retryable:true});return {success:true,contactId:'real'};});
 const {job}=await f.store.enqueue(lead);
 for(let i=0;i<5;i++){await f.store.run(job.id);f.advance();}
 assert.equal((await f.store.read(job.id)).state,'BLOCKED');assert.deepEqual(await f.store.drain(),[]);
 assert.equal((await f.store.status()).blocked,1);
 fail=false;await f.store.resume(job.id);assert.equal((await f.store.status()).blocked,0);assert.equal((await f.store.drain())[0].state,'COMPLETED');
});
test('unconfigured provider blocks instead of generating fake success',async()=>{
 const f=fixture(async()=>{throw Object.assign(new Error(),{code:'HUBSPOT_NOT_CONFIGURED'});});
 const {job}=await f.store.enqueue(lead);assert.equal((await f.store.run(job.id)).state,'BLOCKED');assert.equal((await f.store.read(job.id)).result,undefined);
});
test('unconfirmed provider result is retried and never marked completed',async()=>{
 const f=fixture(async()=>({success:true}));const {job}=await f.store.enqueue(lead);
 assert.equal((await f.store.run(job.id)).state,'RETRY_PENDING');
});
test('newer contact payload supersedes stale queued writes',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {success:true,contactId:'real'};});
 const a=await f.store.enqueue(lead),b=await f.store.enqueue({...lead,company:'Updated'});
 assert.equal((await f.store.run(a.job.id)).state,'SUPERSEDED');assert.equal(calls,0);
 assert.equal((await f.store.run(b.job.id)).state,'COMPLETED');assert.equal(calls,1);
});
test('concurrent workers cannot deliver the same contact twice',async()=>{
 let release;const pending=new Promise(r=>release=r);let calls=0;
 const f=fixture(async()=>{calls++;await pending;return {success:true,contactId:'real'};});const {job}=await f.store.enqueue(lead);
 const a=f.store.run(job.id);await new Promise(r=>setImmediate(r));const b=await f.store.run(job.id);assert.equal(b.state,'BUSY');release();await a;assert.equal(calls,1);
});
test('storage outage does not acknowledge queued work',async()=>{
 const store=createCrmRecovery({command:async()=>{throw new Error('offline');}});await assert.rejects(store.enqueue(lead));
});
test('lost enqueue response recovers the same job by stable ID',async()=>{
 const f=fixture();let lost=true;const store=createCrmRecovery({command:async args=>{const r=await f.command(args);if(args[0]==='EVAL'&&args[1]===ENQUEUE_SCRIPT&&lost){lost=false;throw new Error('lost');}return r;}});
 await assert.rejects(store.enqueue(lead));assert.equal((await store.enqueue(lead)).created,false);
});

function providerTest(t) {
 const previous=process.env.HUBSPOT_ACCESS_TOKEN;process.env.HUBSPOT_ACCESS_TOKEN='qa-only';
 t.after(()=>{if(previous===undefined)delete process.env.HUBSPOT_ACCESS_TOKEN;else process.env.HUBSPOT_ACCESS_TOKEN=previous;});
}
test('existing contact is updated by provider id without deal creation or stage downgrade',async t=>{
 providerTest(t);const calls=[];const result=await syncHubSpotContact(normalizeContact(lead),async(url,options)=>{calls.push({url,...options});return Response.json({id:'123',properties:normalizeContact(lead)});});
 assert.equal(result.contactId,'123');assert.equal(calls.length,3);assert.equal(calls[1].method,'PATCH');assert.ok(calls[1].url.endsWith('/123'));assert.doesNotMatch(calls[1].body,/lifecyclestage|deal|lead_source/);
});
test('create conflict resolves contact and updates rather than creating another deal',async t=>{
 providerTest(t);let call=0;const result=await syncHubSpotContact(normalizeContact(lead),async()=>{call++;return call===1?new Response('',{status:404}):call===2?new Response('',{status:409}):Response.json({id:'123',properties:normalizeContact(lead)});});assert.equal(result.contactId,'123');assert.equal(call,5);
});
test('provider status classification distinguishes retriable and credential failures',async t=>{
 providerTest(t);
 for(const [status,retryable]of [[429,true],[503,true],[401,false],[400,false]])await assert.rejects(syncHubSpotContact(normalizeContact(lead),async()=>new Response('',{status})),e=>e.retryable===retryable);
});
test('lost create response retries via lookup of existing email',async t=>{
 providerTest(t);let created=false,posts=0;
 const fetcher=async(url,options)=>{if(options.method==='GET')return created?Response.json({id:'123',properties:normalizeContact(lead)}):new Response('',{status:404});if(options.method==='POST'){posts++;created=true;throw new Error('lost response');}return Response.json({id:'123',properties:normalizeContact(lead)});};
 await assert.rejects(syncHubSpotContact(normalizeContact(lead),fetcher));assert.equal((await syncHubSpotContact(normalizeContact(lead),fetcher)).contactId,'123');assert.equal(posts,1);
});
test('administrative recovery rejects unauthorized access before external calls',async t=>{
 const old=process.env.PARTNER_API_TOKEN;process.env.PARTNER_API_TOKEN='qa-only';const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error();};
 t.after(()=>{globalThis.fetch=original;if(old===undefined)delete process.env.PARTNER_API_TOKEN;else process.env.PARTNER_API_TOKEN=old;});
 const res={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
 await crm({method:'POST',url:'/api/crm?action=recovery',headers:{},socket:{}},res);assert.equal(res.code,401);assert.equal(calls,0);
});

test('expired worker lease cannot overwrite another worker result',async()=>{
 const f=fixture();const {job}=await f.store.enqueue(lead);
 const command=async args=>args[0]==='EVAL'&&args[1]===FINISH_SCRIPT?'LEASE_LOST':f.command(args);
 const store=createCrmRecovery({command,sync:async()=>({success:true,contactId:'real'}),now:()=>1000});
 await assert.rejects(store.run(job.id),{code:'CRM_LEASE_LOST'});assert.equal((await f.store.read(job.id)).state,'PENDING');
});

test('inbound CRM queue reports pending instead of synthetic success and does not send notifications',async t=>{
 const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const original=globalThis.fetch;const f=fixture();
 process.env.UPSTASH_REDIS_REST_URL='https://qa-only.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='qa-only';
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://qa-only.upstash.io');return Response.json({result:await f.command(JSON.parse(options.body))});};
 t.after(()=>{globalThis.fetch=original;for(const[k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;});
 const {syncInboundLeadToHubSpotAndExplee}=await import('../lib/bidirectional_commercial_sync.js');
 const result=await syncInboundLeadToHubSpotAndExplee(lead);
 assert.equal(result.hubspot.success,false);assert.equal(result.hubspot.synced,false);assert.equal(result.hubspot.status,'BLOCKED');assert.equal(result.explee.success,false);
});

test('intake completes provider synchronization immediately and duplicate intake does not repeat it', async () => {
 let calls = 0;
 const f = fixture(async () => { calls++; return {success:true,synced:true,contactId:'real-contact'}; });
 const input = {...lead, painPoint:'Controlled request'};
 const first = await queueContactSync(input, f.store);
 assert.equal(first.status, 'SYNCED_PROVIDER_CONFIRMED');
 assert.equal(first.synced, true);
 assert.equal((await f.store.read(first.jobId)).request.painPoint, input.painPoint);
 await queueContactSync(input, f.store);
 assert.equal(calls, 1);
 assert.equal((await f.store.status()).queued, 0);
});

test('provider outage retains durable intake and retries after the backoff', async () => {
 let calls = 0;
 const f = fixture(async () => { calls++; throw Object.assign(new Error('Unavailable'), {code:'HUBSPOT_UNAVAILABLE',retryable:true}); });
 const result = await queueContactSync(lead, f.store);
 assert.equal(result.status, 'RETRY_PENDING');
 assert.equal(result.synced, false);
 await queueContactSync(lead, f.store);
 assert.equal(calls, 1);
 assert.equal((await f.store.status()).queued, 1);
});

test('explicit correction retry resumes invalid-response jobs but keeps rate-limit backoff', async () => {
  let broken = true;
  const f = fixture(async () => {
    if (broken) throw Object.assign(new Error(), { code: 'HUBSPOT_INVALID_RESPONSE', retryable: true });
    return { success: true, contactId: 'verified' };
  });
  const { job } = await f.store.enqueue(lead);
  await f.store.run(job.id);
  broken = false;
  await f.store.resume(job.id);
  assert.equal((await f.store.drain())[0].state, 'COMPLETED');
  const limited = fixture(async () => { throw Object.assign(new Error(), { code: 'HUBSPOT_RATE_LIMIT', retryable: true }); });
  const queued = await limited.store.enqueue(lead);
  await limited.store.run(queued.job.id);
  await assert.rejects(limited.store.resume(queued.job.id), { code: 'CRM_NOT_BLOCKED' });
});

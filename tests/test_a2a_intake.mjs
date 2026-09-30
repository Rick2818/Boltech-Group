import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/a2a.js';
import { scorePartnerMatch } from '../lib/partner_network.js';

// Isolated contract tests; these fixtures never contact providers or count as production activity.
const token = 'local-test-credential';
const hash = crypto.createHash('sha256').update(token).digest('hex');
const partners = [{ id: 'recSource', fields: { 'Partner Name': 'Test source', Status: 'ACTIVE', 'A2A Enabled': true, 'A2A Key Hash': hash } }];
function request(overrides = {}) {
  return { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: { jsonrpc: '2.0', id: 1, method: 'SendMessage', params: { message: { messageId: 'message-1', role: 'ROLE_USER', parts: [{ data: { type: 'boltech.referral.need.v1', needSummary: 'Local contract check', serviceType: 'Custom Agent', clientConsent: false, clientEmail: 'private@example.test', clientCompany: 'Private test company' } }] } } }, ...overrides };
}
async function call(req) {
  const res = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; } };
  await handler(req,res); return res;
}
function fixture(t, failure = '') {
  const oldEnv = { ...process.env }; const originalFetch=globalThis.fetch;
  process.env.AIRTABLE_TOKEN='test-only'; process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test'; process.env.UPSTASH_REDIS_REST_TOKEN='test-only';
  const redis=new Map(); const referrals=[]; const activities=[];
  globalThis.fetch=async (url,opts={}) => {
    const body=opts.body ? JSON.parse(opts.body) : null;
    if(String(url).startsWith('https://redis.example.test')) {
      if(failure==='redis' || (failure==='completion' && body[0]==='SET' && body[3]!=='NX')) return new Response('{}',{status:503});
      let result;
      if(body[0]==='GET') result=redis.get(body[1]) ?? null;
      else if(body[3]==='NX' && redis.has(body[1])) result=null;
      else { redis.set(body[1],body[2]); result='OK'; }
      return Response.json({result});
    }
    if(String(url).includes('tblVpKkNAHmJqxME9')) return Response.json({records:partners});
    if(String(url).includes('tbl9d6B8ljjOuQ2ED')) { referrals.push(body.fields); return Response.json({id:'recReferral',fields:body.fields}); }
    if(String(url).includes('tblctlKwiFlhL0mct')) {
      if(failure==='activity') return Response.json({error:{message:'private provider error'}},{status:503});
      activities.push(body.fields); return Response.json({id:'recActivity'});
    }
    throw new Error(`Unexpected test request ${url}`);
  };
  t.after(()=> { globalThis.fetch=originalFetch; for(const k of Object.keys(process.env)) if(!(k in oldEnv)) delete process.env[k]; Object.assign(process.env,oldEnv); });
  return {redis,referrals,activities};
}

test('successful registration masks identity, binds attribution and returns A2A v1 task',async t=>{
  const f=fixture(t); const r=await call(request()); assert.equal(r.statusCode,200);
  assert.equal(r.body.result.task.status.state,'TASK_STATE_COMPLETED');
  assert.equal(f.referrals[0].Partner[0],'recSource'); assert.equal(f.referrals[0]['Client Email'],undefined);
  assert.equal(f.referrals[0]['Client Company'],undefined); assert.equal(f.referrals[0].Status,'WAITING_CONSENT');
  assert.equal(f.activities.length,1);
});
test('replay returns original task without another referral or activity',async t=>{
  const f=fixture(t); const first=await call(request()); const second=await call(request());
  assert.deepEqual(second.body.result,first.body.result); assert.equal(f.referrals.length,1); assert.equal(f.activities.length,1);
});
test('concurrent identical messages create at most one referral',async t=>{
  const f=fixture(t); const results=await Promise.all([call(request()),call(request())]);
  assert.equal(f.referrals.length,1); assert.equal(f.activities.length,1); assert.ok(results.some(r=>r.statusCode===200));
});
test('changed content under same messageId is rejected',async t=>{
  const f=fixture(t); await call(request()); const req=request(); req.body.params.message.parts[0].data.needSummary='changed';
  assert.equal((await call(req)).statusCode,409); assert.equal(f.referrals.length,1);
});
test('string consent, invalid budget and malformed parts never write',async t=>{
  const f=fixture(t);
  for(const patch of [{clientConsent:'false'},{budgetUsd:false},{budgetUsd:-1},{serviceType:'invalid'},{needSummary:''}]) {
    const req=request(); Object.assign(req.body.params.message.parts[0].data,patch); assert.equal((await call(req)).statusCode,400);
  }
  const req=request(); req.body.params.message.parts={}; assert.equal((await call(req)).statusCode,400); assert.equal(f.referrals.length,0);
});
test('explicit consent retains authorized contact fields',async t=>{
  const f=fixture(t); const req=request(); req.body.params.message.parts[0].data.clientConsent=true;
  assert.equal((await call(req)).statusCode,200); assert.equal(f.referrals[0]['Client Email'],'private@example.test');
});
test('missing or inactive credentials are denied',async t=>{
  const f=fixture(t); const req=request(); req.headers={}; assert.equal((await call(req)).statusCode,401);
  const active=partners[0].fields.Status; partners[0].fields.Status='PROSPECT';
  try { assert.equal((await call(request())).statusCode,401); } finally {partners[0].fields.Status=active;}
  assert.equal(f.referrals.length,0);
});
test('missing durable store fails closed before referral write',async t=>{
  const f=fixture(t); delete process.env.UPSTASH_REDIS_REST_TOKEN; assert.equal((await call(request())).statusCode,503); assert.equal(f.referrals.length,0);
});
test('failed activity never reports completion or duplicates referral on retry',async t=>{
  const f=fixture(t,'activity'); const first=await call(request()); assert.equal(first.statusCode,503);
  assert.doesNotMatch(JSON.stringify(first.body),/private provider error/);
  assert.equal((await call(request())).statusCode,409); assert.equal(f.referrals.length,1);
});
test('GetTask retrieves completed task and enforces partner scope',async t=>{
  fixture(t); const first=await call(request()); const req=request(); req.body.method='GetTask'; req.body.params={id:first.body.result.task.id};
  assert.deepEqual((await call(req)).body.result,first.body.result.task);
  const savedId=partners[0].id; partners[0].id='recOtherPartner';
  try { assert.equal((await call(req)).statusCode,404); } finally { partners[0].id=savedId; }
  req.body.params.id='f'.repeat(64); assert.equal((await call(req)).statusCode,404);
});
test('legacy message/send returns legacy Task shape',async t=>{
  fixture(t); const req=request(); req.body.method='message/send'; req.body.params.message.role='user';
  const r=await call(req); assert.equal(r.body.result.kind,'task'); assert.equal(r.body.result.status.state,'completed');
});
test('method validation and capability matching reject unsupported work',async t=>{
  fixture(t); assert.equal((await call(request({method:'GET'}))).statusCode,405);
  const req=request(); req.body.method='unknown'; assert.equal((await call(req)).body.error.code,-32601);
  assert.equal(scorePartnerMatch({status:'ACTIVE',capabilities:['Voice Agents'],markets:['Global'],languages:['English']},{serviceType:'CRM Integration',market:'US',language:'English'}),0);
});

test('Redis outage never writes a referral',async t=>{
  const f=fixture(t,'redis'); assert.equal((await call(request())).statusCode,503); assert.equal(f.referrals.length,0);
});
test('completion persistence failure preserves claim and prevents re-registration',async t=>{
  const f=fixture(t,'completion'); assert.equal((await call(request())).statusCode,503);
  assert.equal((await call(request())).statusCode,409); assert.equal(f.referrals.length,1); assert.equal(f.activities.length,1);
});
test('reordered JSON keys replay the same result',async t=>{
  const f=fixture(t); const first=await call(request()); const req=request();
  const card=req.body.params.message.parts[0].data; req.body.params.message.parts[0].data=Object.fromEntries(Object.entries(card).reverse());
  assert.deepEqual((await call(req)).body.result,first.body.result); assert.equal(f.referrals.length,1);
});

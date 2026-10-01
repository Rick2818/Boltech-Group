import test from 'node:test';
import assert from 'node:assert/strict';
import partners from '../api/partners.js';
import payments from '../api/payments.js';

const response = () => ({ headers: {}, setHeader(k,v){this.headers[k]=v;}, status(n){this.statusCode=n;return this;}, json(v){this.body=v;return this;} });
const request = (url, token='') => ({ method:'GET', url, headers:{host:'boltech-group.vercel.app',...(token?{authorization:'Bearer '+token}:{})}, socket:{remoteAddress:'privacy-test'} });

test('public diagnostic endpoints do not reveal configuration, finance or IDs', async t => {
  const old = process.env.PAYMENT_ENV; delete process.env.PAYMENT_ENV;
  t.after(()=>{if(old===undefined)delete process.env.PAYMENT_ENV;else process.env.PAYMENT_ENV=old;});
  for(const [handler,url] of [[partners,'/api/partners?action=health'],[payments,'/api/payments?action=readiness']]){
    const res=response();await handler(request(url),res);
    assert.equal(res.statusCode,200);
    assert.doesNotMatch(JSON.stringify(res.body),/baseId|TableId|finance|Configured|expectedAmountUsd/);
    assert.equal(res.headers['Cache-Control'],'no-store');
  }
});

test('private diagnostics reject missing and wrong credentials before querying data',async t=>{
  const keys=['PARTNER_API_TOKEN','COCKPIT_ACCESS_TOKEN','AIRTABLE_TOKEN','PAYMENT_ENV'];
  const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;
  process.env.PARTNER_API_TOKEN='private-test-only';process.env.AIRTABLE_TOKEN='test-only';process.env.PAYMENT_ENV='production';
  let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('must not fetch');};
  t.after(()=>{globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  for(const token of ['', 'wrong'])for(const [handler,url] of [[partners,'/api/partners?action=metrics'],[partners,'/api/partners?action=health-internal'],[payments,'/api/payments?action=readiness-internal']]){
    const res=response();await handler(request(url,token),res);assert.equal(res.statusCode,401);assert.doesNotMatch(JSON.stringify(res.body),/finance|baseId|tbl|app[A-Z]/);
  }
  assert.equal(calls,0);
  const p=response();await partners(request('/api/partners?action=health-internal','private-test-only'),p);assert.equal(p.statusCode,200);assert.equal(p.body.airtableConfigured,true);
  const r=response();await payments(request('/api/payments?action=readiness-internal','private-test-only'),r);assert.equal(r.statusCode,200);assert.ok(r.body.store.baseId);
  globalThis.fetch=async()=>{calls++;return Response.json({records:[]});};
  const m=response();await partners(request('/api/partners?action=metrics','private-test-only'),m);assert.equal(m.statusCode,200);assert.ok(m.body.metrics.finance);assert.ok(calls>0);
});

test('unconfigured administrative authentication fails closed',async t=>{
  const old=Object.fromEntries(['PARTNER_API_TOKEN','COCKPIT_ACCESS_TOKEN'].map(k=>[k,process.env[k]]));delete process.env.PARTNER_API_TOKEN;delete process.env.COCKPIT_ACCESS_TOKEN;
  t.after(()=>{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  for(const [handler,url] of [[partners,'/api/partners?action=metrics'],[payments,'/api/payments?action=readiness-internal']]){const r=response();await handler(request(url),r);assert.equal(r.statusCode,503);}
});

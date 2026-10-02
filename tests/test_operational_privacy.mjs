import test from 'node:test';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import partners from '../api/partners.js';
import payments from '../api/payments.js';
import {checkWompiConnection,verifyWompiWebhookSignature} from '../lib/payment_providers.js';

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

test('Wompi probe authenticates, checks business mode and sanitizes provider responses', async t=>{
  const old=Object.fromEntries(['WOMPI_APP_ID','WOMPI_API_SECRET','PAYMENT_ENV'].map(k=>[k,process.env[k]]));
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;for(const[k,v]of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  delete process.env.WOMPI_APP_ID;delete process.env.WOMPI_API_SECRET;process.env.PAYMENT_ENV='production';
  globalThis.fetch=async()=>{throw new Error('must not call provider without credentials');};
  assert.equal((await checkWompiConnection()).code,'WOMPI_CREDENTIALS_MISSING');
  process.env.WOMPI_APP_ID='test-id';process.env.WOMPI_API_SECRET='test-secret';
  globalThis.fetch=async()=>Response.json({error_description:'sensitive provider response'},{status:401});
  const denied=await checkWompiConnection();
  assert.equal(denied.code,'WOMPI_AUTHENTICATION_FAILED');assert.equal(denied.providerHttp,401);
  assert.doesNotMatch(JSON.stringify(denied),/sensitive|test-secret/);
  let productive=false;const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,method:options.method});
    if(url.endsWith('/connect/token')){
      assert.equal(new URLSearchParams(options.body).get('audience'),'wompi_api');
      return Response.json({access_token:'private-test-token',expires_in:3600});
    }
    assert.equal(url,'https://api.wompi.sv/Aplicativo');assert.equal(options.method,'GET');
    return Response.json({estaProductivo:productive,idAplicativo:'private-business-id',numeroCuenta:'private-account'});
  };
  const trial=await checkWompiConnection();assert.equal(trial.status,'PASSED');assert.equal(trial.productive,false);
  productive=true;const real=await checkWompiConnection();assert.equal(real.code,'WOMPI_CONNECTED_PRODUCTION');
  assert.doesNotMatch(JSON.stringify(real),/private-|test-secret/);
  assert.ok(calls.every(x=>x.url.endsWith('/connect/token')||x.url.endsWith('/Aplicativo')));
  globalThis.fetch=async()=>Response.json({idAplicativo:'private-id'});
  assert.equal((await checkWompiConnection()).code,'WOMPI_BUSINESS_RESPONSE_INVALID');
});

test('Wompi HMAC detects altered payloads and invalid signatures', t=>{
  const keys=['WOMPI_APP_ID','WOMPI_API_SECRET'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const[k,v]of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  process.env.WOMPI_APP_ID='test-id';process.env.WOMPI_API_SECRET='local-test-secret';
  const body='{"Monto":495}';const signature=crypto.createHmac('sha256','local-test-secret').update(body).digest('hex');
  assert.equal(verifyWompiWebhookSignature(body,signature),true);
  assert.equal(verifyWompiWebhookSignature('{"Monto":1}',signature),false);
  assert.equal(verifyWompiWebhookSignature(body,''),false);
  assert.equal(verifyWompiWebhookSignature(body,'invalid'),false);
});
test('invalid webhook requests reject before storage or provider access', async t=>{
  const old=Object.fromEntries(['WOMPI_APP_ID','WOMPI_API_SECRET'].map(k=>[k,process.env[k]]));
  const original=globalThis.fetch;let calls=0;
  t.after(()=>{globalThis.fetch=original;for(const[k,v]of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  process.env.WOMPI_APP_ID='test-id';process.env.WOMPI_API_SECRET='local-test-secret';
  globalThis.fetch=async()=>{calls++;throw new Error('no external calls allowed');};
  for(const signature of ['', '0'.repeat(64)]){
    const req={method:'POST',url:'/api/payments?action=wompi-webhook',headers:{host:'boltech-group.vercel.app',wompi_hash:signature},
      socket:{remoteAddress:'webhook-health-test'},async *[Symbol.asyncIterator](){yield '{}';}};
    const res=response();await payments(req,res);assert.equal(res.statusCode,401);assert.equal(res.body.code,'INVALID_WEBHOOK_SIGNATURE');
  }
  const res=response();await payments(request('/api/payments?action=wompi-webhook'),res);assert.equal(res.statusCode,405);
  assert.equal(calls,0);
});

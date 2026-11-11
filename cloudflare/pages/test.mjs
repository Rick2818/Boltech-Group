import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, readdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker, {BACKEND_HOST} from './src/_worker.js';

const root = dirname(fileURLToPath(import.meta.url));

test('Pages output contains exactly the public release and preserves source bytes', async () => {
  execFileSync(process.execPath, [resolve(root, 'build.mjs')]);
  const files = ['_worker.js', '_routes.json', 'sales-agent.html'];
  assert.deepEqual((await readdir(resolve(root, 'dist'))).sort(), [...files].sort());
  for (const file of files) assert.deepEqual(await readFile(resolve(root, 'dist', file)), await readFile(resolve(root, 'src', file)));
});

test('signed payment requests preserve raw body, query, authorization and provider status', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let seen;
    globalThis.fetch = async (url, options) => {
      seen = {url: String(url), options, body: await new Response(options.body).text()};
      return new Response('provider response', {status: 202, headers: {'X-Provider-Receipt': 'test-only'}});
    };
    const raw = '{ "signed": "payload" }';
    const response = await worker.fetch(new Request('https://boltech-group.pages.dev/api/payments?action=callback', {
      method: 'POST', body: raw,
      headers: {'Content-Type': 'application/json', 'wompi_hash': 'fixture-signature', Authorization: 'Bearer fixture', 'CF-Connecting-IP': '192.0.2.1', 'X-Forwarded-For': 'forged'}
    }), {});
    assert.equal(seen.url, `https://${BACKEND_HOST}/api/payments?action=callback`);
    assert.equal(seen.body, raw);
    assert.equal(seen.options.headers.get('wompi_hash'), 'fixture-signature');
    assert.equal(seen.options.headers.get('Authorization'), 'Bearer fixture');
    assert.equal(seen.options.headers.get('X-Forwarded-For'), '192.0.2.1');
    assert.equal(seen.options.redirect, 'manual');
    assert.equal(response.status, 202);
    assert.equal(response.headers.get('X-Provider-Receipt'), 'test-only');
    globalThis.fetch = async () => {throw Error('offline');};
    const failed = await worker.fetch(new Request('https://boltech-group.pages.dev/api/payments?action=status'), {});
    assert.equal(failed.status, 502);
    assert.equal((await failed.json()).success, false);
  } finally {globalThis.fetch = originalFetch;}
});

test('Leo cannot expose platform access or speech without runtime authorization/configuration', async () => {
  const integrations = await worker.fetch(new Request('https://boltech-group.pages.dev/api/leo-integrations', {method: 'POST', body: '{"action":"status"}'}), {});
  assert.equal(integrations.status, 503);
  const speech = await worker.fetch(new Request('https://boltech-group.pages.dev/api?leo_speech=1', {method: 'POST', body: '{"text":"hola"}'}), {});
  assert.equal(speech.status, 503);
  assert.equal((await speech.json()).error, 'SPEECH_NOT_CONFIGURED');
});

test('Leo greeting remains local and other pages keep their immutable backend', async () => {
  const response = await worker.fetch(new Request('https://boltech-group.pages.dev/api?leo_sales=1', {method: 'POST', body: '{"message":"hola Leo","history":[]}'}), {});
  const data = await response.json();
  assert.equal(data.mode, 'WELCOME');
  assert.match(data.reply, /soy Leo/);
  assert.deepEqual(data.authorizedActions, []);
  const page = await worker.fetch(new Request('https://boltech-group.pages.dev/sales-agent'), {ASSETS: {fetch: async () => new Response('Leo UI')}});
  assert.equal(await page.text(), 'Leo UI');
  assert.equal(page.headers.get('Cache-Control'), 'no-store');
});

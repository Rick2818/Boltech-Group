import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { BACKEND_HOST } from '../cloudflare/pages-leo-audio-worker.mjs';

test('only Leo GET/HEAD uses the corrected asset; existing pages and API retain their immutable backend', async () => {
  const saved = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response('existing page');
  };
  try {
    for (const path of ['/sales-agent', '/sales-agent.html', '/sales-agent/']) {
      const result = await worker.fetch(new Request('https://boltech-group.pages.dev' + path), {
        ASSETS: { fetch: async () => new Response('<main>corrected Leo</main>', { headers: { 'Content-Type': 'text/html' } }) }
      });
      assert.equal(await result.text(), '<main>corrected Leo</main>');
      assert.equal(result.headers.get('Cache-Control'), 'no-store');
    }
    assert.equal(calls.length, 0);
    for (const path of ['/', '/commerce-admin', '/api?leo_speech=1', '/api/payments?action=status']) {
      const result = await worker.fetch(new Request('https://boltech-group.pages.dev' + path), {});
      assert.equal(await result.text(), 'existing page');
      assert.equal(calls.at(-1).url, 'https://' + BACKEND_HOST + path);
    }
  } finally { globalThis.fetch = saved; }
});

test('signed raw bytes, auth, cookies, status and audio headers survive without forged forwarded IPs or redirect following', async () => {
  const saved = globalThis.fetch;
  const bytes = new Uint8Array([0, 255, 10, 13, 123, 32, 125]);
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).host, BACKEND_HOST);
    assert.equal(new URL(url).pathname, '/api//attacker.example');
    assert.equal(new URL(url).search, '?signature=a%2Bb');
    assert.equal(init.redirect, 'manual');
    assert.deepEqual(new Uint8Array(await new Response(init.body).arrayBuffer()), bytes);
    assert.equal(init.headers.get('Authorization'), 'Bearer qa-not-a-real-token');
    assert.equal(init.headers.get('Cookie'), 'session=qa');
    assert.equal(init.headers.get('x-forwarded-for'), '192.0.2.4');
    assert.equal(init.headers.get('x-forwarded-host'), null);
    return new Response('audio', { status: 206, headers: {
      'Content-Type': 'audio/mpeg', 'X-Boltech-Voice-Id': 'es-SV-RodrigoNeural', 'Set-Cookie': 'session=qa; HttpOnly; Secure'
    } });
  };
  try {
    const result = await worker.fetch(new Request('https://boltech-group.pages.dev/api//attacker.example?signature=a%2Bb', {
      method: 'POST', body: bytes, headers: { Authorization: 'Bearer qa-not-a-real-token', Cookie: 'session=qa',
        'x-forwarded-for': 'forged', 'x-forwarded-host': 'attacker.example', 'CF-Connecting-IP': '192.0.2.4' }
    }), {});
    assert.equal(result.status, 206);
    assert.equal(result.headers.get('Content-Type'), 'audio/mpeg');
    assert.equal(result.headers.get('X-Boltech-Voice-Id'), 'es-SV-RodrigoNeural');
    assert.match(result.headers.get('Set-Cookie'), /HttpOnly/);
  } finally { globalThis.fetch = saved; }
});

test('same-site redirects retain visitor host, external payment redirects remain intact, failures stay failures', async () => {
  const saved = globalThis.fetch;
  try {
    for (const [location, expected] of [
      ['https://' + BACKEND_HOST + '/sales-agent?lang=en', 'https://boltech-group.pages.dev/sales-agent?lang=en'],
      ['https://checkout.wompi.sv/qa-only', 'https://checkout.wompi.sv/qa-only']
    ]) {
      globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: location } });
      const result = await worker.fetch(new Request('https://boltech-group.pages.dev/'), {});
      assert.equal(result.status, 302);
      assert.equal(result.headers.get('Location'), expected);
    }
    globalThis.fetch = async () => new Response('denied', { status: 401 });
    assert.equal((await worker.fetch(new Request('https://boltech-group.pages.dev/api'), {})).status, 401);
    globalThis.fetch = async () => { throw Error('offline'); };
    assert.equal((await worker.fetch(new Request('https://boltech-group.pages.dev/api'), {})).status, 502);
  } finally { globalThis.fetch = saved; }
});

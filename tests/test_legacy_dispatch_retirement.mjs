import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import handler from '../api/index.js';

test('legacy dashboard dispatch rejects live and dry-run requests without contacting providers', async () => {
  const previousFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw Error('Unexpected external call'); };
  try {
    for (const url of ['/api/dashboard/trigger-dispatch', '/dashboard/trigger-dispatch']) {
      for (const dryRun of [false, true, undefined]) {
        const headers = {};
        const res = {
          setHeader(name, value) { headers[name] = value; },
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = body; return this; }
        };
        await handler({ method: 'POST', url, headers: { host: 'localhost' }, body: { dryRun } }, res);
        assert.equal(res.statusCode, 410);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, 'LEGACY_COMMERCIAL_RETIRED');
        assert.equal(headers['Cache-Control'], 'no-store');
      }
    }
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('old hunter and SMTP sender have no remaining executable entry point', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.hunter, undefined);
  assert.equal(existsSync('scripts/outbound/run_cron_hunter.mjs'), false);
  assert.equal(existsSync('scripts/outbound/send_smtp_dispatch.mjs'), false);
});

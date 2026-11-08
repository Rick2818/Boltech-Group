import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('Bilingual i18n data attributes and asset completeness', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const elements = [...html.matchAll(/<([a-z][a-z0-9-]*)(\s[^>]*?)?>/gi)].map(([, tag, attrs = '']) => ({ tag, attrs }));
  const localized = elements.filter(({ attrs }) => /\bdata-es\s*=/.test(attrs) || /\bdata-en\s*=/.test(attrs));
  assert.ok(localized.length > 50, `Expected more than 50 localized elements, found ${localized.length}`);
  const hasValue = (attrs, name) => {
    const marker = name + '=';
    const start = attrs.indexOf(marker);
    if (start < 0) return false;
    const quote = attrs[start + marker.length];
    if (quote !== '"' && quote !== "'") return false;
    const end = attrs.indexOf(quote, start + marker.length + 1);
    return end > start + marker.length + 1;
  };
  assert.deepEqual(localized.filter(({ attrs }) => !hasValue(attrs, 'data-es')), [], 'Every localized element must define data-es');
  assert.deepEqual(localized.filter(({ attrs }) => !hasValue(attrs, 'data-en')), [], 'Every localized element must define data-en');
  assert.match(html, /querySelectorAll\(\s*["']\[data-es\]/, 'Runtime must apply the bilingual data contract');
  for (const asset of ['assets/brand/app-icon-192.png', 'assets/js/web-reception.js', 'manifest.webmanifest']) {
    assert.ok(fs.existsSync(path.join(root, asset)), `Required asset is missing: ${asset}`);
  }
});

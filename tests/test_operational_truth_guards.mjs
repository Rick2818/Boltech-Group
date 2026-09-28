import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('canonical 19 rules exist and explicitly prohibit simulated production activity', () => {
  const rules = read('.agents/rules/BOLTECH_19_REGLAS_DE_ORO_CANONICAS.md');
  assert.match(rules, /19 Reglas de Oro Canónicas/);
  assert.match(rules, /CERO SIMULACIÓN/);
  assert.match(rules, /ACEPTADO POR EL PROVEEDOR/);
  assert.match(rules, /ricardo\.boltechgroup@gmail\.com/);
  assert.match(rules, /Investigar → verificar → resumir → planificar → ejecutar/);
});

test('official mail engine uses Boltech Gmail identity and does not fabricate provider IDs', () => {
  const mail = read('lib/universal_email_engine.js');
  assert.match(mail, /ricardo\.boltechgroup@gmail\.com/);
  assert.doesNotMatch(mail, /ricardo\.boltechai@gmail\.com/);
  assert.doesNotMatch(mail, /messageId:\s*`smtp_\$\{Date\.now\(\)/);
  assert.doesNotMatch(mail, /messageId:\s*['"]resend_ok['"]/);
  assert.match(mail, /deliveryStatus:\s*'ACCEPTED_BY_PROVIDER'/);
  assert.match(mail, /providerResponse/);
});

test('scheduled workflows cannot invoke legacy outbound dispatch scripts', () => {
  const workflowDir = path.join(ROOT, '.github', 'workflows');
  const files = fs.readdirSync(workflowDir).filter(f => /\.ya?ml$/i.test(f));
  assert.ok(files.length > 0, 'Expected scheduled workflows.');
  for (const file of files) {
    const body = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    assert.doesNotMatch(body, /scripts\/outbound\//i, `${file} must not schedule legacy outbound scripts`);
    assert.doesNotMatch(body, /autonomous_hunter/i, `${file} must not schedule autonomous_hunter`);
  }
});

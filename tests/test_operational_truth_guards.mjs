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

test('WON does not create commission before cash is collected', () => {
  const api = read('api/partners.js');
  assert.doesNotMatch(api, /buildWonUpdate/);
  assert.match(api, /commissionPolicy:\s*'CASH_COLLECTED_ONLY'/);
  assert.match(api, /action === 'commission-entry'/);
  assert.match(api, /customerPaymentReference is required as real payment evidence/);
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


test('A2A referral exchange publishes a standard v1 agent card and protects referral intake', () => {
  const card = JSON.parse(read('agent-card.json'));
  assert.equal(card.name, 'Boltech Agent Referral Exchange');
  assert.equal(card.supportedInterfaces?.[0]?.protocolVersion, '1.0');
  assert.equal(card.supportedInterfaces?.[0]?.protocolBinding, 'JSONRPC');
  assert.equal(card.supportedInterfaces?.[0]?.url, 'https://boltech-group.vercel.app/api/a2a');
  assert.ok(card.skills?.some(s => s.id === 'register-referral-need'));

  const vercel = read('vercel.json');
  assert.match(vercel, /\.well-known\/agent-card\.json/);

  const api = read('api/a2a.js');
  assert.match(api, /findA2APartnerByKeyHash/);
  assert.match(api, /createHash\('sha256'\)/);
  assert.doesNotMatch(api, /card\.partnerRecordId/);
  assert.match(api, /clientConsent/);
  assert.match(api, /WAITING_CONSENT/);
  assert.match(api, /scorePartnerMatch/);
  assert.match(api, /providerCandidates/);
  assert.match(api, /requiresEnrollment:\\s*true/);
  assert.match(api, /relationshipStatus:\\s*'PROSPECT'/);
  assert.match(api, /source: 'A2A'/);
});

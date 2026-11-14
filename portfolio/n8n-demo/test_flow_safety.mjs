import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const currentDir = dirname(fileURLToPath(import.meta.url));
const flow = JSON.parse(readFileSync(join(currentDir, 'boltech_demo_n8n.json'), 'utf8'));
const nodes = new Map(flow.nodes.map(n => [n.name, n]));
const edges = flow.connections ?? {};

test('la demo permanece inactiva y contiene nodos únicos', () => {
  assert.equal(flow.active, false);
  assert.equal(nodes.size, flow.nodes.length);
  assert.equal(flow.nodes.filter(n => n.type.endsWith('Trigger')).length, 1);
});

test('el formulario llega a Sheets, Telegram y Gmail sin enlaces rotos', () => {
  for (const [source, data] of Object.entries(edges)) {
    assert.ok(nodes.has(source), 'Origen inexistente: ' + source);
    for (const outgoing of data.main ?? []) {
      for (const edge of outgoing) assert.ok(nodes.has(edge.node), 'Destino inexistente: ' + edge.node);
    }
  }
  const reached = new Set();
  function visit(node) {
    if (reached.has(node)) return;
    reached.add(node);
    for (const output of edges[node]?.main ?? []) {
      for (const edge of output) visit(edge.node);
    }
  }
  visit('Formulario - nuevo lead');
  for (const name of nodes.keys()) assert.ok(reached.has(name), 'Nodo desconectado: ' + name);
});

test('no se incluyen credenciales ni referencias a IDs reales en el JSON de plantilla', () => {
  for (const node of flow.nodes) {
    assert.equal(node.credentials, undefined, 'No subir credenciales: ' + node.name);
  }
  const sheets = nodes.get('Google Sheets - agregar lead');
  const telegram = flow.nodes.filter(n => n.type === 'n8n-nodes-base.telegram');
  assert.equal(sheets.parameters.documentId.value, 'REEMPLAZAR_SPREADSHEET_ID');
  assert.equal(telegram.length, 2);
  for (const node of telegram) assert.equal(node.parameters.chatId, 'REEMPLAZAR_CHAT_ID');
});

test('Gmail nunca envía automáticamente al email de un formulario público', () => {
  const gmail = nodes.get('Gmail - seguimiento');
  assert.equal(gmail.type, 'n8n-nodes-base.gmail');
  assert.equal(gmail.parameters.sendTo, "={{ $vars.BOLTECH_DEMO_TEST_INBOX || '' }}");
  assert.ok(!/json\\.email|normalizar lead.*email/i.test(gmail.parameters.sendTo));
  assert.match(gmail.parameters.subject, /prueba interna/i);
});

test('Gmail maneja errores y reintentos con alerta a Telegram', () => {
  const gmail = nodes.get('Gmail - seguimiento');
  assert.equal(gmail.onError, 'continueErrorOutput');
  assert.equal(gmail.retryOnFail, true);
  assert.equal(gmail.maxTries, 3);
  const errorOutput = edges[gmail.name]?.main?.[1] ?? [];
  assert.ok(errorOutput.some(e => e.node === 'IF - fallo correo'));
  const telegramAlert = edges['IF - fallo correo']?.main?.flat() ?? [];
  assert.ok(telegramAlert.some(e => e.node === 'Telegram - avisar error correo'));
});

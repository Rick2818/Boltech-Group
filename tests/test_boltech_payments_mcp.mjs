import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Contrato v2 del servidor MCP de pagos: solo expone estado de configuración.
// Las herramientas que crean o consultan cobros están deshabilitadas a propósito;
// las órdenes reales se crean y concilian en /api/payments.
const serverPath = path.resolve('mcp/boltech-payments-mcp.mjs');
const DISABLED_TOOLS = [
  ['strike_create_invoice', { amount_usd: 69, description: 'Plan Pro $69 USD via Lightning' }],
  ['strike_get_invoice', { invoice_id: 'inv-test' }],
  ['wompi_create_payment_link', { amount_usd: 69, description: 'Plan Pro' }],
  ['wompi_get_transaction', { transaction_id: 'tx-test' }]
];

// Entorno aislado: no hereda credenciales ni PAYMENT_ENV del proceso padre.
function isolatedEnv(overrides = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(PAYMENT_ENV|STRIKE_|WOMPI_)/.test(key)) delete env[key];
  }
  return { ...env, ...overrides };
}

// El cierre del cliente va en finally: si una aserción falla, el proceso hijo
// del servidor MCP no queda vivo y la suite no se cuelga.
async function withClient(env, fn) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath], env, stderr: 'ignore' });
  const client = new Client({ name: 'boltech-test-client', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

test('Boltech Payments MCP: lista herramientas y reporta estado sin revelar credenciales', { timeout: 30000 }, async () => {
  const canary = 'CANARY_SECRET_DO_NOT_LEAK';
  const env = isolatedEnv({
    PAYMENT_ENV: 'sandbox',
    STRIKE_SANDBOX_API_KEY: canary,
    STRIKE_WEBHOOK_SECRET: canary,
    WOMPI_APP_ID: 'app-id-canary',
    WOMPI_API_SECRET: canary
  });

  await withClient(env, async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const name of ['payments_status', ...DISABLED_TOOLS.map(([n]) => n)]) {
      assert.ok(names.includes(name), `Debe exponer la herramienta ${name}`);
    }

    const status = await client.callTool({ name: 'payments_status', arguments: {} });
    assert.notStrictEqual(status.isError, true, 'payments_status no debe fallar con PAYMENT_ENV definido');
    const text = status.content[0].text;
    assert.ok(!text.includes(canary), 'payments_status nunca debe revelar credenciales');
    assert.ok(!text.includes('app-id-canary'), 'payments_status nunca debe revelar identificadores de credenciales');

    const parsed = JSON.parse(text);
    assert.strictEqual(parsed.environment, 'sandbox');
    assert.strictEqual(parsed.strike.configured, true);
    assert.strictEqual(parsed.strike.webhookConfigured, true);
    assert.strictEqual(parsed.strike.environment, 'sandbox');
    assert.strictEqual(parsed.wompi.configured, true);
    assert.strictEqual(parsed.policy, 'PROVIDER_VERIFICATION_REQUIRED');
    assert.strictEqual(parsed.mutations, 'DISABLED_IN_MCP_USE_VERIFIED_PAYMENT_API');
  });
});

test('Boltech Payments MCP: sin credenciales reporta configured=false', { timeout: 30000 }, async () => {
  await withClient(isolatedEnv({ PAYMENT_ENV: 'sandbox' }), async (client) => {
    const parsed = JSON.parse((await client.callTool({ name: 'payments_status', arguments: {} })).content[0].text);
    assert.strictEqual(parsed.strike.configured, false);
    assert.strictEqual(parsed.wompi.configured, false);
  });
});

test('Boltech Payments MCP: las herramientas que crean o consultan cobros están deshabilitadas', { timeout: 30000 }, async () => {
  await withClient(isolatedEnv({ PAYMENT_ENV: 'sandbox' }), async (client) => {
    for (const [name, args] of DISABLED_TOOLS) {
      const result = await client.callTool({ name, arguments: args });
      assert.strictEqual(result.isError, true, `${name} debe devolver error`);
      assert.match(result.content[0].text, /deshabilitada/i, `${name} debe explicar que está deshabilitada`);
      assert.ok(!/READY_FOR_(PAYMENT|COMMERCE)|checkout\.wompi\.co/.test(result.content[0].text), `${name} no debe fabricar links ni facturas`);
    }
  });
});

test('Boltech Payments MCP: falla cerrado si PAYMENT_ENV no está configurado', { timeout: 30000 }, async () => {
  await withClient(isolatedEnv(), async (client) => {
    const result = await client.callTool({ name: 'payments_status', arguments: {} });
    assert.strictEqual(result.isError, true, 'Sin PAYMENT_ENV debe devolver error, nunca asumir un entorno');
    assert.match(result.content[0].text, /PAYMENT_ENV/);
  });
});

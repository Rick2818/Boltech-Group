import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('Boltech Payments MCP exposes status and fail-closed mutation guards', async () => {
  const serverPath = path.resolve('mcp/boltech-payments-mcp.mjs');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { ...process.env, STRIKE_API_KEY: '', STRIKE_SANDBOX_API_KEY: '', WOMPI_PRIVATE_KEY: '', WOMPI_ENV: 'sandbox', PAYMENT_ENV: 'sandbox', USD_COP_RATE: '4000' }
  });
  const client = new Client({ name: 'boltech-test-client', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(tool => tool.name);
    for (const name of ['payments_status', 'strike_create_invoice', 'strike_get_invoice', 'wompi_create_payment_link', 'wompi_get_transaction']) assert.ok(toolNames.includes(name), 'Missing MCP tool: ' + name);
    const status = await client.callTool({ name: 'payments_status', arguments: {} });
    const parsed = JSON.parse(status.content[0].text);
    assert.equal(parsed.strike.configured, false);
    assert.equal(parsed.wompi.configured, false);
    assert.equal(parsed.environment, 'sandbox');
    assert.equal(parsed.policy, 'PROVIDER_VERIFICATION_REQUIRED');
    const blocked = [
      ['strike_create_invoice', { amount_usd: 69 }],
      ['strike_get_invoice', { invoice_id: 'synthetic-invoice' }],
      ['wompi_create_payment_link', { amount_usd: 69 }],
      ['wompi_get_transaction', { transaction_id: 'synthetic-transaction' }]
    ];
    for (const [name, args] of blocked) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, name + ' must remain fail-closed');
      assert.match(result.content[0].text, /deshabilitada|disabled/i);
    }
  } finally {
    await client.close();
  }
});

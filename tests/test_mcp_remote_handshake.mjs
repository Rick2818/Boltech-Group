import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handleBoltechMcpHttp } from '../mcp/server/http_handler.mjs';

function startTestServer() {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);

    if (chunks.length) {
      try {
        req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        req.body = undefined;
      }
    }

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (value) => {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    };

    await handleBoltechMcpHttp(req, res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('remote MCP completes handshake, lists tools and executes boltech_status', async () => {
  const previous = process.env.BOLTECH_MCP_API_KEY;
  process.env.BOLTECH_MCP_API_KEY = 'boltech-mcp-ci-secret';

  const server = await startTestServer();
  const address = server.address();
  const url = new URL(`http://127.0.0.1:${address.port}/api/mcp`);

  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        Authorization: 'Bearer boltech-mcp-ci-secret'
      }
    }
  });
  const client = new Client({ name: 'boltech-ci-client', version: '1.0.0' });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    assert.ok(names.includes('boltech_status'));
    assert.ok(names.includes('get_bitcoin_market_data'));
    assert.ok(names.includes('research_b2b_lead'));

    const result = await client.callTool({
      name: 'boltech_status',
      arguments: {}
    });

    assert.ok(Array.isArray(result.content));
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.service, 'Boltech Group Remote MCP');
    assert.equal(payload.status, 'ok');
    assert.equal(payload.write_tools_enabled, false);
  } finally {
    try { await client.close(); } catch {}
    await new Promise((resolve) => server.close(resolve));

    if (previous === undefined) delete process.env.BOLTECH_MCP_API_KEY;
    else process.env.BOLTECH_MCP_API_KEY = previous;
  }
});

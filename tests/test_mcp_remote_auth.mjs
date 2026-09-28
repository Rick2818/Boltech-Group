import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeMcpRequest } from '../mcp/server/auth.mjs';

test('remote MCP rejects requests when API key is not configured', () => {
  const previous = process.env.BOLTECH_MCP_API_KEY;
  delete process.env.BOLTECH_MCP_API_KEY;
  const result = authorizeMcpRequest({ headers: {} });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  if (previous !== undefined) process.env.BOLTECH_MCP_API_KEY = previous;
});

test('remote MCP requires a matching Bearer token', () => {
  const previous = process.env.BOLTECH_MCP_API_KEY;
  process.env.BOLTECH_MCP_API_KEY = 'unit-test-secret';

  assert.equal(authorizeMcpRequest({ headers: {} }).status, 401);
  assert.equal(authorizeMcpRequest({ headers: { authorization: 'Bearer wrong' } }).status, 401);
  assert.equal(authorizeMcpRequest({ headers: { authorization: 'Bearer unit-test-secret' } }).ok, true);

  if (previous === undefined) delete process.env.BOLTECH_MCP_API_KEY;
  else process.env.BOLTECH_MCP_API_KEY = previous;
});

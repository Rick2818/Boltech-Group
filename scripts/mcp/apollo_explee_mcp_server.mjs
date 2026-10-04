#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createApolloClient, validateApolloEmail, apolloError } from '../../lib/apollo_client.js';

const TOOLS = [
  { name: 'apollo_search_saved_contacts', description: 'Read real saved Apollo contacts with complete bounded pagination. No outreach or paid enrichment.',
    inputSchema: { type: 'object', properties: { qKeywords: { type: 'string' }, perPage: { type: 'integer', minimum: 1, maximum: 100 }, maxPages: { type: 'integer', minimum: 1, maximum: 20 } }, additionalProperties: false } },
  { name: 'apollo_search_infrastructure_leads', description: 'Research new prospects using real Apollo People API search. Returns provider IDs and obfuscated names; no emails or outreach.',
    inputSchema: { type: 'object', properties: {
      titles: { type: 'array', items: { type: 'string' } }, locations: { type: 'array', items: { type: 'string' } },
      technologyUids: { type: 'array', items: { type: 'string' } }, page: { type: 'integer', minimum: 1, maximum: 500 },
      perPage: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false } },
  { name: 'apollo_verify_email_zero_bounce', description: 'Legacy name: checks syntax and MX only. Does not confirm a mailbox or guarantee zero bounces.',
    inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'], additionalProperties: false } }
];
export function createMcpHandler({ client = createApolloClient(), validateEmail = validateApolloEmail } = {}) {
  return async request => {
    if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') return { jsonrpc: '2.0', id: request?.id ?? null, error: { code: -32600, message: 'INVALID_REQUEST' } };
    if (request.id === undefined) return null;
    const id = request.id;
    if (request.method === 'initialize') return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'boltech-apollo-explee-mcp', version: '2.0.0' } } };
    if (request.method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    if (request.method !== 'tools/call') return { jsonrpc: '2.0', id, error: { code: -32601, message: 'METHOD_NOT_FOUND' } };
    const name = request.params?.name, args = request.params?.arguments || {};
    try {
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw apolloError('APOLLO_INVALID_INPUT');
      let result;
      if (name === 'apollo_search_saved_contacts') {
        const allowed = ['qKeywords', 'perPage', 'maxPages'];
        if (Object.keys(args).some(key => !allowed.includes(key))) throw apolloError('APOLLO_UNSUPPORTED_FILTER');
        if (args.maxPages > 20) throw apolloError('APOLLO_INVALID_PAGINATION');
        result = await client.listSavedContacts(args);
      } else if (name === 'apollo_search_infrastructure_leads') {
        if (Object.keys(args).some(key => !['titles', 'locations', 'technologyUids', 'page', 'perPage'].includes(key)))
          throw apolloError('APOLLO_UNSUPPORTED_FILTER');
        result = await client.searchPeople(args);
      } else if (name === 'apollo_verify_email_zero_bounce') {
        if (Object.keys(args).some(key => key !== 'email')) throw apolloError('APOLLO_INVALID_INPUT');
        result = await validateEmail(args.email);
      } else throw apolloError('TOOL_NOT_IMPLEMENTED');
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } };
    } catch (error) {
      return { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: JSON.stringify({
        success: false, code: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'APOLLO_TOOL_FAILED', retryable: error.retryable === true }) }] } };
    }
  };
}
export function serveStdio(handler = createMcpHandler()) {
  let buffer = '', pending = Promise.resolve();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 262144) { process.stderr.write('MCP_INPUT_LIMIT\n'); process.exitCode = 1; process.stdin.destroy(); return; }
    const lines = buffer.split('\n'); buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      pending = pending.then(async () => {
        let request, response;
        try { request = JSON.parse(line); response = await handler(request); }
        catch { response = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'PARSE_ERROR' } }; }
        if (response) process.stdout.write(JSON.stringify(response) + '\n');
      });
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) serveStdio();

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authorizeMcpRequest } from './auth.mjs';
import { createBoltechRemoteMcpServer } from './create_server.mjs';

export async function handleBoltechMcpHttp(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = authorizeMcpRequest(req);
  if (!auth.ok) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Boltech MCP"');
    return res.status(auth.status).json({ error: auth.code });
  }

  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const server = createBoltechRemoteMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[Boltech MCP HTTP]', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'MCP_INTERNAL_ERROR' });
    }
  } finally {
    try { await transport.close(); } catch {}
  }
}

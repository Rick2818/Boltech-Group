export const UPWORK_MCP_ENDPOINT = 'https://mcp.upwork.com/mcp';

const READ_ONLY_JOB_SEARCH = /^(search|find|list|get|read).*(job|posting)|(job|posting).*(search|list|read|details?)$/i;
const QUERY_KEYS = ['query', 'keywords', 'searchTerm', 'search_query', 'q', 'text'];

function readOnlyJobSearchTool(tool) {
  return Boolean(tool && READ_ONLY_JOB_SEARCH.test(String(tool.name || '')) &&
    tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint !== true);
}

function searchArguments(tool, query, limit) {
  const schema = tool.inputSchema || {};
  const properties = schema.properties || {};
  const args = {};
  const queryKey = QUERY_KEYS.find(key => Object.hasOwn(properties, key));
  if (queryKey) args[queryKey] = query;
  for (const key of ['limit', 'pageSize', 'page_size', 'perPage', 'per_page', 'maxResults']) {
    if (Object.hasOwn(properties, key)) args[key] = Math.min(limit, 10);
  }
  const unsupportedRequired = (schema.required || []).filter(key => !Object.hasOwn(args, key));
  if (!queryKey || unsupportedRequired.length) return null;
  return args;
}

function extractRows(result) {
  if (!result || result.isError) throw Object.assign(new Error('UPWORK_MCP_TOOL_FAILED'), { code: 'UPWORK_MCP_TOOL_FAILED' });
  const blocks = Array.isArray(result.content) ? result.content : [];
  const rows = [];
  for (const block of blocks) {
    if (block?.type !== 'text' || typeof block.text !== 'string') continue;
    let data;
    try { data = JSON.parse(block.text); } catch { continue; }
    if (Array.isArray(data)) rows.push(...data);
    else if (data && typeof data === 'object') {
      for (const key of ['jobs', 'jobPostings', 'job_postings', 'results', 'items']) {
        if (Array.isArray(data[key])) { rows.push(...data[key]); break; }
      }
    }
  }
  return rows;
}

export async function fetchUpworkFreelanceJobs({
  query = process.env.UPWORK_MCP_SEARCH_QUERY || 'AI agent automation n8n CRM integrations lead generation',
  limit = 10,
  qaCaseId,
  oauthProvider,
  clientFactory
} = {}) {
  if (!oauthProvider) {
    const [{ getRedisClient }, { UpworkMcpOAuthProvider }] = await Promise.all([
      import('./distributed_cache.js'),
      import('./upwork_mcp_oauth_provider.js')
    ]);
    let redis;
    try { redis=getRedisClient(); } catch {}
    oauthProvider=new UpworkMcpOAuthProvider({
      redis,
      vaultKey:process.env.UPWORK_MCP_VAULT_KEY,
      onAuthorizationUrl:()=>{throw Object.assign(new Error('UPWORK_MCP_OAUTH_NOT_AUTHORIZED_IN_AGENT1_RUNTIME'),{code:'UPWORK_MCP_OAUTH_NOT_AUTHORIZED_IN_AGENT1_RUNTIME'});}
    });
  }

  let client;
  let transport;
  try {
    if (clientFactory) {
      ({ client, transport } = await clientFactory({ endpoint: UPWORK_MCP_ENDPOINT, oauthProvider }));
    } else {
      const { Client } = await import('@modelcontextprotocol/sdk/client');
      const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
      client = new Client({ name: 'boltech-agent1-upwork-readonly', version: '1.0.0' });
      transport = new StreamableHTTPClientTransport(new URL(UPWORK_MCP_ENDPOINT), { authProvider:oauthProvider });
    }

    await client.connect(transport);
    const listed = await client.listTools();
    const candidates = (listed.tools || []).filter(readOnlyJobSearchTool)
      .map(tool => ({ tool, args: searchArguments(tool, query, limit) }))
      .filter(item => item.args);
    if (!candidates.length) {
      throw Object.assign(new Error('UPWORK_MCP_READ_ONLY_JOB_SEARCH_TOOL_UNAVAILABLE'), { code: 'UPWORK_MCP_READ_ONLY_JOB_SEARCH_TOOL_UNAVAILABLE' });
    }

    const { tool, args } = candidates[0];
    const result = await client.callTool({ name: tool.name, arguments: args });
    const opportunities = extractRows(result)
      .filter(row => row && typeof row === 'object')
      .filter(row => row.qa !== true && (!qaCaseId || (row.id !== qaCaseId && row.requestId !== qaCaseId)))
      .slice(0, Math.max(1, Math.min(Number(limit) || 10, 10)))
      .map(row => ({ ...row, source: 'UPWORK_OFFICIAL_MCP', sourceVerified: true, qualification: 'RESEARCH_REQUIRED' }));
    return { opportunities, toolName: tool.name };
  } catch (error) {
    if (error?.code) throw error;
    const code = error?.status === 401 || error?.name === 'UnauthorizedError'
      ? 'UPWORK_MCP_OAUTH_INVALID_OR_EXPIRED'
      : 'UPWORK_MCP_REQUEST_FAILED';
    throw Object.assign(new Error(code), { code });
  } finally {
    try { await client?.close?.(); } catch {}
    try { await transport?.close?.(); } catch {}
  }
}

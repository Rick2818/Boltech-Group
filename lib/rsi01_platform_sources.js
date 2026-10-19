// Platform research only. Never send, buy Connects, infer an email or approve a buyer.
const community = 'https://community.n8n.io';
const mcpUrl = 'https://mcp.upwork.com/mcp';
const fail = code => { throw Object.assign(new Error(code), {code}); };
const text = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const demand = /\b(?:hiring|looking for|seeking|wanted|need(?:ed)?|help needed|buscamos|necesito|necesitamos|se busca)\b/i;
const supply = /\b(?:for hire|available for|seeking (?:work|projects)|looking for (?:work|projects|a job)|offering|busco trabajo)\b/i;
const fit = /\b(?:n8n|automation|automatizaci[oó]n|workflow|ai agent|chatbot|integrations?|integraciones)\b/i;
const fresh = (date, now) => { const age = Date.parse(now) - Date.parse(date); return Number.isFinite(age) && age >= 0 && age <= 45 * 86400000; };
const signal = (source, id, title, url, createdAt, summary, author = null) => ({
  source, sourceId: `${source}-${id}`, title: text(title).slice(0, 240), sourceUrl: url,
  publishedAt: createdAt, observedAt: new Date().toISOString(), author,
  requestSummary: text(summary).slice(0, 700), state: 'PLATFORM_RESEARCH_PENDING',
  contactChannel: source === 'UPWORK' ? 'UPWORK_PROPOSAL' : 'N8N_COMMUNITY_THREAD',
  contactEligible: false, buyerVerified: false, customerNeedConfirmed: false, sendingEnabled: false
});

export async function discoverN8nJobs({fetcher = fetch, now = new Date().toISOString(), existing = new Set(), limit = 5} = {}) {
  const get = async path => {
    const response = await fetcher(community + path, {redirect: 'error', headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(6000)});
    if (!response.ok) fail('N8N_COMMUNITY_HTTP_' + response.status);
    return response.json();
  };
  const data = await get('/c/jobs/13.json');
  if (!Array.isArray(data?.topic_list?.topics)) fail('N8N_COMMUNITY_RESPONSE_INVALID');
  const topics = data.topic_list.topics.filter(t => Number.isSafeInteger(t.id) && t.category_id === 13 &&
    !t.closed && !t.archived && !t.pinned && fresh(t.created_at, now) &&
    demand.test(t.title) && fit.test(t.title) && !supply.test(t.title) && !existing.has('N8N_COMMUNITY-' + t.id));
  const found = [], errors = [];
  // Inspect only the requesting author's first post, never freelancer replies.
  for (const topic of topics.slice(0, 8)) {
    if (found.length >= limit) break;
    try {
      const detail = await get(`/t/${topic.id}.json`);
      const first = detail?.post_stream?.posts?.find(p => p.post_number === 1);
      if (detail.id !== topic.id || detail.closed || detail.archived || !first?.username || !text(first.cooked)) continue;
      found.push(signal('N8N_COMMUNITY', topic.id, topic.title, `${community}/t/${topic.id}`, topic.created_at, first.cooked, first.username));
    } catch (error) { errors.push(error.code || 'N8N_TOPIC_UNAVAILABLE'); }
  }
  return {source: 'N8N_COMMUNITY', status: 'OBSERVED', found, errors, authenticationRequired: false, cloudInstanceConnected: false};
}

export function unpackMcp(result) {
  if (result?.isError) fail('UPWORK_MCP_TOOL_FAILED');
  if (result?.structuredContent) return result.structuredContent;
  const content = result?.content?.find(c => c.type === 'text')?.text;
  try { return JSON.parse(content); } catch { fail('UPWORK_MCP_RESPONSE_INVALID'); }
}

export async function discoverUpworkJobs({env = process.env, now = new Date().toISOString(), existing = new Set(), limit = 5, clientFactory} = {}) {
  const token = String(env.UPWORK_MCP_ACCESS_TOKEN || '').trim();
  if (!token) return {source: 'UPWORK', status: 'BLOCKED', code: 'UPWORK_EXECUTOR_OAUTH_REQUIRED', found: [], chatConnectorIsSeparate: true};
  let client;
  try {
    if (clientFactory) client = await clientFactory();
    else {
      const [{Client}, {StreamableHTTPClientTransport}] = await Promise.all([
        import('@modelcontextprotocol/sdk/client/index.js'), import('@modelcontextprotocol/sdk/client/streamableHttp.js')
      ]);
      client = new Client({name: 'boltech-agent1-research', version: '1.0.0'});
      await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), {
        requestInit: {headers: {Authorization: `Bearer ${token}`}, redirect: 'error', signal: AbortSignal.timeout(25000)}
      }), {timeout: 10000});
    }
    const listed = await client.listTools({}, {timeout: 10000});
    const name = suffix => listed.tools.find(t => t.name === suffix || t.name === 'upwork__' + suffix)?.name || fail('UPWORK_READ_TOOL_MISSING');
    const call = async (tool, args) => unpackMcp(await client.callTool({name: name(tool), arguments: args}, undefined, {timeout: 10000}));
    const accounts = await call('list_accounts', {});
    const talent = (accounts.accounts || []).filter(a => a.role === 'TALENT');
    const org = env.UPWORK_ORG_UID || (talent.length === 1 ? talent[0].org_uid : null);
    if (!org || !talent.some(a => a.org_uid === org)) fail('UPWORK_EXECUTOR_ACCOUNT_UNCONFIRMED');
    const response = await call('find_jobs', {action: 'search', org_uid: org, params: {
      title: 'n8n', verified_payment_only: true, sort: 'recency', limit: 5, include_full_details: true
    }});
    if (!Array.isArray(response.jobs)) fail('UPWORK_MCP_JOBS_INVALID');
    const found = response.jobs.filter(j => /^\d{8,30}$/.test(String(j.id)) && !j.applied && fresh(j.published_date || j.created_date, now) &&
      !existing.has('UPWORK-' + j.id)).slice(0, limit).map(j => signal('UPWORK', j.id, j.title,
        `https://www.upwork.com/jobs/~02${j.id}`, j.published_date || j.created_date, j.description || j.description_snippet));
    return {source: 'UPWORK', status: 'OBSERVED', found, accountVerified: true, proposalEligibilityVerified: false};
  } catch (error) {
    return {source: 'UPWORK', status: 'BLOCKED', code: /^UPWORK_[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'UPWORK_MCP_AUTH_OR_REQUEST_FAILED', found: []};
  } finally { if (client) await client.close().catch(() => {}); }
}

export async function discoverPlatformSources({now = new Date().toISOString(), existing = new Set(), limit = 5, n8n = discoverN8nJobs, upwork = discoverUpworkJobs} = {}) {
  const settled = await Promise.allSettled([upwork({now, existing, limit}), n8n({now, existing, limit})]);
  const sources = settled.map((r, i) => r.status === 'fulfilled' ? r.value : ({source: i ? 'N8N_COMMUNITY' : 'UPWORK', status: 'BLOCKED', code: i ? 'N8N_COMMUNITY_UNAVAILABLE' : 'UPWORK_MCP_UNAVAILABLE', found: []}));
  const found = [], seen = new Set(existing);
  // Share the five research slots across available sources; one outage never cancels the other.
  for (let i = 0; i < limit; i++) for (const source of sources) {
    const item = source.found[i];
    if (found.length < limit && item && !seen.has(item.sourceId)) { found.push(item); seen.add(item.sourceId); }
  }
  return {sources: sources.map(({found, ...s}) => ({...s, observed: found.length})), found, verifiedBusinessLeads: 0, sendingEnabled: false};
}

export async function storePlatformResearch({work, request, discover = discoverPlatformSources, now = new Date().toISOString()}) {
  const table = 'tblHVqUMifOFjlGvj', prefix = 'RSI01:PLATFORM_SIGNAL:';
  const day=value=>new Date(Date.parse(value)-6*3600000).toISOString().slice(0,10);
  const recordedToday=work.filter(w=>{
    if(!String(w.fields?.['Work ID']||'').startsWith(prefix))return false;
    try{return day(JSON.parse(w.fields.Evidence).observedAt)===day(now);}catch{return false;}
  }).length;
  const remaining=Math.max(0,5-recordedToday);
  if(!remaining)return {sources:[],observed:0,stored:0,target:5,dailyLimitReached:true,verifiedBusinessLeads:0,sendingEnabled:false,scope:'PLATFORM_RESEARCH_ONLY'};
  const existing = new Set(work.map(w => String(w.fields?.['Work ID'] || '')).filter(id => id.startsWith(prefix)).map(id => id.slice(prefix.length)));
  const result = await discover({now, existing, limit: remaining});
  let stored = 0;
  for (const item of result.found.slice(0, remaining)) {
    if (existing.has(item.sourceId)) continue;
    const evidence = JSON.stringify({...item, observedAt: now});
    const fields = {'Work ID': prefix + item.sourceId, RSI: 'RSI-01', Status: 'PENDING_RSI01_RESEARCH', Evidence: evidence,
      'Next Action': `RSI-01: review request and eligibility on ${item.contactChannel}. Keep contact on the source platform; do not infer email, buyer approval, or a sale.`};
    const created = await request(table, {method: 'POST', body: {records: [{fields}]}});
    const row = created.records?.[0];
    if (!row?.id || row.fields?.Evidence !== evidence || row.fields?.['Work ID'] !== fields['Work ID']) fail('PLATFORM_RESEARCH_WRITE_UNCONFIRMED');
    existing.add(item.sourceId); stored++;
  }
  return {sources: result.sources, observed: result.found.length, stored, target: 5,
    verifiedBusinessLeads: 0, sendingEnabled: false, scope: 'PLATFORM_RESEARCH_ONLY'};
}

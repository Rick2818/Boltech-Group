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

// Single-owner integration. The user subject is trusted server configuration,
// never a request parameter. Connect owns refresh tokens; none leave the server.
export async function getUpworkRuntimeIdentity({env = process.env, readRuntimeIdentity} = {}) {
  const configured = String(env.VERCEL_OIDC_TOKEN || '').trim();
  if (configured) return configured;
  try {
    // Vercel Functions supplies OIDC through its trusted request context.
    // Do not accept an arbitrary inbound HTTP header or read local CLI accounts.
    if (!readRuntimeIdentity && env !== process.env) fail('UPWORK_CONNECT_RUNTIME_IDENTITY_REQUIRED');
    const read = readRuntimeIdentity || (await import('@vercel/oidc')).getVercelOidcTokenSync;
    const identity = read();
    if (typeof identity !== 'string' || !identity.trim()) fail('UPWORK_CONNECT_RUNTIME_IDENTITY_REQUIRED');
    return identity;
  } catch { fail('UPWORK_CONNECT_RUNTIME_IDENTITY_REQUIRED'); }
}

async function connectRequest(operation, {env = process.env, fetcher = fetch, readRuntimeIdentity} = {}) {
  const connector = String(env.UPWORK_CONNECTOR_UID || '').trim();
  if (!connector) fail('UPWORK_EXECUTOR_OAUTH_REQUIRED');
  const identity = await getUpworkRuntimeIdentity({env, readRuntimeIdentity});
  if (!env.UPWORK_CONNECT_USER_ID) fail('UPWORK_CONNECT_OWNER_REQUIRED');
  const response = await fetcher(`https://api.vercel.com/v1/connect/${operation}/${encodeURIComponent(connector)}`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: {Authorization: `Bearer ${identity}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({subject: {type: 'user', id: env.UPWORK_CONNECT_USER_ID},
      ...(operation === 'authorize' ? {returnUrl: 'https://boltech-group.vercel.app'} : {})})
  });
  const data = await response.json();
  if (!response.ok) {
    const code = String(data?.error?.code || data?.code || data?.error || '');
    if (/invalid_client/i.test(code)) fail('UPWORK_CONNECT_CLIENT_REJECTED');
    if (/authoriz|consent/i.test(code)) fail('UPWORK_CONNECT_AUTHORIZATION_REQUIRED');
    fail('UPWORK_CONNECT_REQUEST_FAILED');
  }
  return data;
}

export async function getUpworkToken(options = {}) {
  const env = options.env || process.env;
  if (!env.UPWORK_CONNECTOR_UID) {
    const token = String(env.UPWORK_MCP_ACCESS_TOKEN || '').trim();
    if (!token) fail('UPWORK_EXECUTOR_OAUTH_REQUIRED');
    return token;
  }
  const data = await connectRequest('token', options);
  if (typeof data.token !== 'string' || !data.token.trim()) fail('UPWORK_CONNECT_TOKEN_UNCONFIRMED');
  return data.token;
}

export async function startUpworkAuthorization(options = {}) {
  const data = await connectRequest('authorize', options);
  let url;
  try { url = new URL(data.url); } catch { fail('UPWORK_CONNECT_AUTH_URL_INVALID'); }
  if (url.origin !== 'https://connect.vercel.com' || !url.pathname.startsWith('/authorize/') || url.username || url.password) fail('UPWORK_CONNECT_AUTH_URL_INVALID');
  return {url: url.href, authorizationCompleted: false};
}

export async function discoverUpworkJobs({env = process.env, now = new Date().toISOString(), existing = new Set(), limit = 5, clientFactory, fetcher = fetch} = {}) {
  let client;
  try {
    const token = await getUpworkToken({env, fetcher});
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
    return {source: 'UPWORK', status: 'BLOCKED', code: /^UPWORK_[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'UPWORK_MCP_AUTH_OR_REQUEST_FAILED', found: [], chatConnectorIsSeparate: true};
  } finally { if (client) await client.close().catch(() => {}); }
}

// Consume platform Work rows directly; they deliberately have no CRM Lead ID.
// This reviews the saved source snapshot and creates a durable review packet,
// without claiming current proposal eligibility or sending a message.
export async function reviewPlatformResearch({work, request, now = new Date().toISOString(), limit = 5}) {
  let assessed = 0, failed = 0;
  const queue = work.filter(w => w.fields?.RSI === 'RSI-01' && w.fields.Status === 'PENDING_RSI01_RESEARCH' &&
    String(w.fields['Work ID'] || '').startsWith('RSI01:PLATFORM_SIGNAL:')).slice(0, limit);
  for (const row of queue) {
    try {
      let item; try { item = JSON.parse(row.fields.Evidence); } catch { item = {}; }
      const id = String(item.sourceId || '');
      const matched = row.fields['Work ID'] === 'RSI01:PLATFORM_SIGNAL:' + id;
      const expectedUrl = item.source === 'N8N_COMMUNITY' && /^N8N_COMMUNITY-\d+$/.test(id) ?
        community + '/t/' + id.slice(14) : item.source === 'UPWORK' && /^UPWORK-\d{8,30}$/.test(id) ?
          'https://www.upwork.com/jobs/~02' + id.slice(7) : null;
      const valid = matched && expectedUrl && item.sourceUrl === expectedUrl && fresh(item.publishedAt, now) &&
        (item.source === 'UPWORK' || demand.test(item.title || '')) && fit.test(item.title || '') && !supply.test(item.title || '') && text(item.requestSummary);
      const status = valid ? 'PLATFORM_CONTACT_REVIEW_REQUIRED' : 'PLATFORM_RESEARCH_INVALID';
      const missing = valid ? ['PLATFORM_CONTACT_ELIGIBILITY_UNVERIFIED', 'ACCOUNTABLE_BUYER_UNVERIFIED', 'CUSTOMER_NEED_UNCONFIRMED'] : ['PLATFORM_SOURCE_EVIDENCE_INVALID_OR_STALE'];
      const evidence = JSON.stringify({...item, review: {at: now, owner: 'RSI-01', status,
        assessmentScope: 'SAVED_SOURCE_SNAPSHOT', missing, sendingEnabled: false, buyerVerified: false,
        proposedNextStep: valid ? 'Review current source rules and account eligibility before any platform contact; clarify the requested workflow in writing.' : 'Reject this research snapshot; obtain valid source evidence.'}});
      const fields = {Status: status, Evidence: evidence, 'Updated At': now,
        'Next Action': valid ? `RSI-01: review ${item.contactChannel} eligibility and source rules. Buyer and need remain unconfirmed. No email inferred; no message or proposal submitted.` : 'RSI-01: invalid or stale platform evidence; do not contact.'};
      const result = await request('tblHVqUMifOFjlGvj', {method: 'PATCH', body: {records: [{id: row.id, fields}]}});
      const saved = result.records?.[0];
      if (saved?.id !== row.id || saved.fields?.Evidence !== evidence || saved.fields?.Status !== status) fail('PLATFORM_REVIEW_WRITE_UNCONFIRMED');
      assessed++;
    } catch { failed++; }
  }
  return {assessed, failed, sendingEnabled: false, verifiedBusinessLeads: 0};
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

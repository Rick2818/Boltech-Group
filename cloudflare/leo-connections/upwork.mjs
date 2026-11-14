// Server-only adapter to the official Upwork MCP server, hosted on Cloudflare.
// The caller cannot choose subjects, organizations, URLs, tools, or actions.
import {getUpworkToken} from './upwork-oauth.mjs';
const MCP_URL = 'https://mcp.upwork.com/mcp';
const clean = value => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').trim().slice(0,500) : '';
const fail = code => { throw new Error(code); };
async function boundedText(response) {
  if (!response.body) return '';
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = '', size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1048576) fail('UPWORK_RESPONSE_TOO_LARGE');
      text += decoder.decode(value,{stream:true});
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(()=>{}); }
}
async function responseJSON(response, id) {
  if (!(response.headers.get('content-type') || '').includes('text/event-stream')) {
    try { return JSON.parse(await boundedText(response)); } catch { fail('UPWORK_MCP_RESPONSE_INVALID'); }
  }
  const reader=response.body?.getReader(); if(!reader) fail('UPWORK_MCP_RESPONSE_INVALID');
  const decoder=new TextDecoder(); let buffer='',size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(value) {size+=value.byteLength; if(size>1048576) fail('UPWORK_RESPONSE_TOO_LARGE'); buffer+=decoder.decode(value,{stream:true});}
      if(done) buffer+='\n\n';
      let match;
      while((match=/\r?\n\r?\n/.exec(buffer))) {
        const event=buffer.slice(0,match.index); buffer=buffer.slice(match.index+match[0].length);
        const data=event.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
        if(!data) continue;
        let message; try {message=JSON.parse(data);} catch {fail('UPWORK_MCP_RESPONSE_INVALID');}
        if(message.id===id) return message;
      }
      if(done) fail('UPWORK_MCP_RESPONSE_INVALID');
    }
  } finally {await reader.cancel().catch(()=>{});}
}
export async function upworkRead(env, action, query, fetchFn = fetch) {
  if (!['check','search'].includes(action)) fail('UPWORK_ACTION_NOT_ALLOWED');
  if (action === 'search' && (typeof query !== 'string' || query.length < 3 || query.length > 300)) fail('INVALID_QUERY');
  const signal = AbortSignal.timeout(16000);
  const credential = {token:await getUpworkToken(env,fetchFn)};
  let session, protocol = '2025-03-26';
  async function rpc(method, params, id) {
    const headers = {Authorization:'Bearer '+credential.token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
    if (session) headers['Mcp-Session-Id'] = session;
    if (method !== 'initialize') headers['MCP-Protocol-Version'] = protocol;
    const response = await fetchFn(MCP_URL, {method:'POST',redirect:'manual',signal,headers,
      body:JSON.stringify({jsonrpc:'2.0',...(id === undefined ? {} : {id}),method,params})});
    if (!response.ok) fail('UPWORK_MCP_HTTP_'+response.status);
    if (method === 'initialize') session = response.headers.get('mcp-session-id');
    if (id === undefined) { await response.body?.cancel(); return; }
    const envelope = await responseJSON(response,id);
    if (envelope.id !== id || envelope.jsonrpc !== '2.0' || envelope.error || !envelope.result) fail('UPWORK_MCP_REJECTED');
    return envelope.result;
  }
  const initialized = await rpc('initialize',{protocolVersion:protocol,capabilities:{},clientInfo:{name:'Boltech-Leo-ReadOnly',version:'1.0.0'}},1);
  if (!['2025-03-26','2024-11-05','2025-06-18','2025-11-25'].includes(initialized.protocolVersion)) fail('UPWORK_MCP_PROTOCOL_UNSUPPORTED');
  protocol = initialized.protocolVersion;
  await rpc('notifications/initialized',{},undefined);
  const tool = action === 'check' ? 'get_account' : 'find_jobs';
  const arguments_ = {org_uid:env.UPWORK_ORG_UID.trim(),action: action === 'check' ? 'get_user_details' : 'search',
    params: action === 'check' ? {} : {query,limit:10,sort:'recency'}};
  const result = await rpc('tools/call',{name:tool,arguments:arguments_},2);
  if (result.isError) fail('UPWORK_TOOL_REJECTED');
  let payload = result.structuredContent;
  if (!payload) {
    for (const block of result.content || []) {
      if (block.type !== 'text') continue;
      try { payload = JSON.parse(block.text); break; } catch {}
    }
  }
  if (!payload || typeof payload !== 'object' || payload.success === false || payload.error || payload.error_code) fail('UPWORK_TOOL_RESPONSE_INVALID');
  const value = payload.result || payload.data || payload;
  if (!value || value.success === false || value.error || value.error_code) fail('UPWORK_TOOL_REJECTED');
  if (action === 'check') return {success:true,platform:'upwork',status:'CONNECTED',checkedAt:new Date().toISOString(),mode:'READ_ONLY'};
  const jobs = value.jobs || value.results;
  if (!Array.isArray(jobs)) fail('UPWORK_SEARCH_RESPONSE_INVALID');
  return {items:jobs.slice(0,10).map(job=>({id:String(job.id || job.job_id || ''),title:clean(job.title),
    url:typeof job.url === 'string' && /^https:\/\/(?:www\.)?upwork\.com\//.test(job.url) ? job.url : null,
    budget:job.budget ?? null})), meta:{provider:'UPWORK_MCP',order:'recency'}};
}

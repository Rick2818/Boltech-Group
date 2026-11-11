// Direct Upwork OAuth for the canonical Cloudflare Pages origin. No broker.
const OAUTH_ORIGIN = 'https://boltech-group.pages.dev';
const OAUTH_RESOURCE = 'https://mcp.upwork.com/mcp';
const OAUTH_AUTHORIZE = 'https://www.upwork.com/ab/account-security/oauth2/authorize';
const OAUTH_TOKEN = 'https://www.upwork.com/api/v3/oauth2/token';
const OAUTH_CLIENT = OAUTH_ORIGIN + '/api/upwork/client-metadata';
const OAUTH_CALLBACK = OAUTH_ORIGIN + '/api/upwork/callback';
const OAUTH_COOKIE = '__Host-leo_upwork';
const OAUTH_STORE = 'leo:upwork:oauth:v1';
const encoder = new TextEncoder();
const oauthJSON = (data,status=200,headers={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer',...headers}});
const oauthError = code => { throw Error(code); };
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const unb64u = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const nonce = () => b64u(crypto.getRandomValues(new Uint8Array(32)));
async function oauthKey(env) {
  if(typeof env.LEO_PLATFORM_TOKEN !== 'string' || env.LEO_PLATFORM_TOKEN.length < 24) oauthError('UPWORK_OWNER_KEY_MISSING');
  const key = await crypto.subtle.digest('SHA-256',encoder.encode('boltech:upwork:oauth:v1:'+env.LEO_PLATFORM_TOKEN));
  return crypto.subtle.importKey('raw',key,'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(value,env,purpose) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(purpose)},await oauthKey(env),encoder.encode(JSON.stringify(value)));
  return b64u(iv)+'.'+b64u(data);
}
async function unseal(value,env,purpose) {
  const parts = String(value).split('.'); if(parts.length !== 2 || value.length > 48000) oauthError('UPWORK_AUTH_STATE_INVALID');
  try {
    const data = await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64u(parts[0]),additionalData:encoder.encode(purpose)},await oauthKey(env),unb64u(parts[1]));
    return JSON.parse(new TextDecoder().decode(data));
  } catch { oauthError('UPWORK_AUTH_STATE_INVALID'); }
}
const cookieHeader = value => `${OAUTH_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${value?'600':'0'}`;
async function tokenRequest(fields,fetchFn) {
  const response = await fetchFn(OAUTH_TOKEN,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),
    headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
    body:new URLSearchParams({...fields,client_id:OAUTH_CLIENT,resource:OAUTH_RESOURCE})});
  if(!response.ok) oauthError(response.status===400 || response.status===401 ? 'UPWORK_REAUTHORIZATION_REQUIRED' : 'UPWORK_TOKEN_HTTP_'+response.status);
  let data; try { data = await response.json(); } catch { oauthError('UPWORK_TOKEN_RESPONSE_INVALID'); }
  if(typeof data.access_token !== 'string' || !data.access_token || data.access_token.length>16000 || /[\r\n]/.test(data.access_token)
    || String(data.token_type).toLowerCase() !== 'bearer' || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in)<=0) oauthError('UPWORK_TOKEN_RESPONSE_INVALID');
  if(data.refresh_token !== undefined && (typeof data.refresh_token !== 'string' || data.refresh_token.length>16000 || /[\r\n]/.test(data.refresh_token))) oauthError('UPWORK_TOKEN_RESPONSE_INVALID');
  return {access_token:data.access_token,refresh_token:typeof data.refresh_token==='string'?data.refresh_token:undefined,
    expiresAt:Date.now()+Number(data.expires_in)*1000};
}
async function saveTokens(data,env) {
  if(!env.COMMERCE?.put) oauthError('UPWORK_AUTH_STORAGE_MISSING');
  await env.COMMERCE.put(OAUTH_STORE,await seal(data,env,'tokens'));
}
export async function upworkConfiguration(env) {
  const missing=[];
  if(!String(env.UPWORK_ORG_UID||'').trim()) missing.push('UPWORK_ORG_UID');
  if(!env.COMMERCE?.get || !env.COMMERCE?.put) missing.push('COMMERCE');
  if(typeof env.LEO_PLATFORM_TOKEN!=='string' || env.LEO_PLATFORM_TOKEN.length<24) missing.push('LEO_PLATFORM_TOKEN');
  let authorized=false;
  if(!missing.length) {try {authorized=!!await env.COMMERCE.get(OAUTH_STORE);} catch {missing.push('COMMERCE_READ_UNAVAILABLE');}}
  return {configured:!missing.length,authorized:!!authorized,mode:'DIRECT_MCP_READ_ONLY',missing};
}
export async function getUpworkToken(env,fetchFn=fetch) {
  if(!env.COMMERCE?.get) oauthError('UPWORK_AUTH_STORAGE_MISSING');
  const stored=await env.COMMERCE.get(OAUTH_STORE);
  if(!stored) oauthError('UPWORK_AUTHORIZATION_REQUIRED');
  let tokens; try { tokens=await unseal(stored,env,'tokens'); } catch { oauthError('UPWORK_REAUTHORIZATION_REQUIRED'); }
  if(typeof tokens.access_token!=='string' || !tokens.expiresAt) oauthError('UPWORK_REAUTHORIZATION_REQUIRED');
  if(tokens.expiresAt>Date.now()+60000) return tokens.access_token;
  if(!tokens.refresh_token) oauthError('UPWORK_REAUTHORIZATION_REQUIRED');
  // Provider refresh is authoritative; failures never overwrite a newer token.
  const refreshed=await tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refresh_token},fetchFn);
  refreshed.refresh_token ||= tokens.refresh_token;
  await saveTokens(refreshed,env); return refreshed.access_token;
}
export async function handleUpworkOAuth(request,env,authorize,fetchFn=fetch) {
  const url=new URL(request.url);
  if(url.pathname==='/api/upwork/client-metadata') {
    if(request.method!=='GET') return oauthJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
    return oauthJSON({client_id:OAUTH_CLIENT,client_name:'Boltech Group — Leo',client_uri:OAUTH_ORIGIN,
      redirect_uris:[OAUTH_CALLBACK],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'});
  }
  if(url.origin!==OAUTH_ORIGIN) return oauthJSON({success:false,error:'CANONICAL_ORIGIN_REQUIRED'},403);
  if(url.pathname==='/api/upwork/start') {
    if(request.method!=='POST') return oauthJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
    if(!authorize(request,env)) return oauthJSON({success:false,error:'OWNER_ACCESS_REQUIRED'},401);
    if(request.headers.get('Origin') && request.headers.get('Origin')!==OAUTH_ORIGIN) return oauthJSON({success:false,error:'ORIGIN_NOT_ALLOWED'},403);
    if(!env.COMMERCE?.get || !env.COMMERCE?.put) return oauthJSON({success:false,error:'UPWORK_AUTH_STORAGE_MISSING'},503);
    const state=nonce(),verifier=nonce();
    const challenge=b64u(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));
    const envelope=await seal({state,verifier,expiresAt:Date.now()+600000},env,'browser-state');
    const target=new URL(OAUTH_AUTHORIZE);
    for(const [key,value]of Object.entries({response_type:'code',client_id:OAUTH_CLIENT,redirect_uri:OAUTH_CALLBACK,
      state,code_challenge:challenge,code_challenge_method:'S256',resource:OAUTH_RESOURCE})) target.searchParams.set(key,value);
    return oauthJSON({success:true,authorizationUrl:target.href},200,{'Set-Cookie':cookieHeader(envelope)});
  }
  if(url.pathname!=='/api/upwork/callback') return oauthJSON({success:false,error:'NOT_FOUND'},404);
  if(request.method!=='GET') return oauthJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
  if(!url.search) return oauthJSON({success:true,code:'UPWORK_CALLBACK_READY',connected:false});
  const cleared={'Set-Cookie':cookieHeader('')};
  try {
    const values=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(OAUTH_COOKIE+'='));
    if(values.length!==1 || url.searchParams.getAll('state').length!==1 || url.searchParams.getAll('code').length>1 || url.searchParams.getAll('error').length>1) oauthError('UPWORK_AUTH_STATE_INVALID');
    const state=await unseal(values[0].slice(OAUTH_COOKIE.length+1),env,'browser-state');
    if(!/^[A-Za-z0-9_-]{43}$/.test(state.verifier||'') || state.state!==url.searchParams.get('state')
      || !Number.isFinite(state.expiresAt) || state.expiresAt<Date.now() || state.expiresAt>Date.now()+600000) oauthError('UPWORK_AUTH_STATE_INVALID');
    if(url.searchParams.has('error')) oauthError('UPWORK_AUTHORIZATION_DECLINED');
    const code=url.searchParams.get('code');
    if(!code || code.length>2048 || /[\x00-\x1f]/.test(code)) oauthError('UPWORK_AUTH_CODE_INVALID');
    // Authorization codes are single use at Upwork; PKCE binds exchange to this browser.
    const tokens=await tokenRequest({grant_type:'authorization_code',code,code_verifier:state.verifier,redirect_uri:OAUTH_CALLBACK},fetchFn);
    await saveTokens(tokens,env);
    return new Response('Upwork autorizado. Puedes cerrar esta pestaña y pulsar Verificar conexiones en Leo.',{
      headers:{...cleared,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
  } catch(error) {
    const safe=['UPWORK_AUTH_STATE_INVALID','UPWORK_AUTHORIZATION_DECLINED','UPWORK_AUTH_CODE_INVALID','UPWORK_TOKEN_RESPONSE_INVALID','UPWORK_REAUTHORIZATION_REQUIRED','UPWORK_AUTH_STORAGE_MISSING'];
    const code=safe.includes(error.message) || /^UPWORK_TOKEN_HTTP_\d{3}$/.test(error.message)?error.message:'UPWORK_AUTHORIZATION_FAILED';
    return oauthJSON({success:false,error:code},400,cleared);
  }
}

// Server-only adapter to the official Upwork MCP server, hosted on Cloudflare.
// The caller cannot choose subjects, organizations, URLs, tools, or actions.
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

// Private, owner-initiated reads only. No bidding, messaging or campaigns.
const integrationJSON = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const integrationText = value => typeof value==='string' ? value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,500) : '';
function integrationAuthorized(request,env) {
  const expected=String(env.LEO_PLATFORM_TOKEN||'');
  const supplied=request.headers.get('Authorization')||'';
  if(expected.length<24 || supplied.length!==expected.length+7) return false;
  const target='Bearer '+expected; let difference=0;
  for(let i=0;i<target.length;i++) difference|=supplied.charCodeAt(i)^target.charCodeAt(i);
  return difference===0;
}
async function integrationProvider(url,options) {
  const response=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(!response.ok) {
    const error = Error('PROVIDER_HTTP_'+response.status);
    if(new URL(url).hostname === 'api.explee.com' && response.status === 403) {
      const body=(await response.text()).slice(0,2000).toLowerCase();
      error.providerReason = /cloudflare|challenge|error code: 10/.test(body) ? 'EDGE_ACCESS_DENIED'
        : /invalid.{0,20}(api.key|token)|not authenticated/.test(body) ? 'API_KEY_REJECTED'
        : 'ACCESS_DENIED_UNCLASSIFIED';
    }
    throw error;
  }
  const data=await response.json();
  if(!data || data.status==='error' || data.success===false) throw Error('PROVIDER_REJECTED');
  return data;
}
async function handleLeoIntegrations(request,env) {
  if(request.method!=='POST') return integrationJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
  if(!env.LEO_PLATFORM_TOKEN || String(env.LEO_PLATFORM_TOKEN).length<24) return integrationJSON({success:false,error:'OWNER_ACCESS_NOT_CONFIGURED'},503);
  if(!integrationAuthorized(request,env)) return integrationJSON({success:false,error:'OWNER_ACCESS_REQUIRED'},401);
  const origin=request.headers.get('Origin');
  if(origin && origin!==new URL(request.url).origin) return integrationJSON({success:false,error:'ORIGIN_NOT_ALLOWED'},403);
  let input;
  try { const raw=await request.text(); if(raw.length>4000) throw Error(); input=JSON.parse(raw); }
  catch { return integrationJSON({success:false,error:'INVALID_REQUEST'},400); }
  if(!input || !['status','check','search'].includes(input.action)) return integrationJSON({success:false,error:'INVALID_ACTION'},400);
  const upwork = await upworkConfiguration(env);
  if(input.action==='status') return integrationJSON({success:true,verified:false,mode:'PRIVATE_READ_ONLY',
    freelancer:{configured:!!env.FREELANCER_OAUTH_TOKEN,enabled:env.FREELANCER_API_ENABLED==='true'},
    explee:{configured:!!env.EXPLEE_API_KEY},upwork,release:'connections-20261110-v2',externalActions:[]});
  const platform=input.platform;
  if(!['freelancer','explee','upwork'].includes(platform)) return integrationJSON({success:false,error:'INVALID_PLATFORM'},400);
  const key=platform==='freelancer'?env.FREELANCER_OAUTH_TOKEN:env.EXPLEE_API_KEY;
  if(platform!=='upwork' && !key) return integrationJSON({success:false,error:'PROVIDER_SECRET_MISSING',platform},503);
  if(platform==='freelancer' && env.FREELANCER_API_ENABLED!=='true') return integrationJSON({success:false,error:'FREELANCER_API_DISABLED',platform},409);
  const headers=platform==='freelancer'?{'Freelancer-OAuth-V1':key,Accept:'application/json'}:{'X-API-Key':key,'Content-Type':'application/json'};
  let activeReceipt=null;
  try {
    if(input.action==='check') {
      if(platform==='upwork') return integrationJSON(await upworkRead(env,'check'));
      const data=platform==='freelancer'
        ? await integrationProvider('https://www.freelancer.com/api/users/0.1/self/',{headers})
        : await integrationProvider('https://api.explee.com/public/api/v1/search/nl-to-filters',{method:'POST',headers,body:JSON.stringify({query:'Business workflow automation companies'})});
      if(platform==='freelancer' && !data.result?.id) throw Error('PROVIDER_RESPONSE_INVALID');
      if(platform==='explee' && (!data.companies_filters || typeof data.companies_filters!=='object')) throw Error('PROVIDER_RESPONSE_INVALID');
      return integrationJSON({success:true,platform,status:'CONNECTED',checkedAt:new Date().toISOString(),mode:'READ_ONLY'});
    }
    const query=integrationText(input.query);
    if(query.length<3 || query.length>300) return integrationJSON({success:false,error:'INVALID_QUERY'},400);
    // Persist a receipt before the provider call. A failed ledger blocks searches.
    if(!env.COMMERCE?.put) return integrationJSON({success:false,error:'RECEIPT_STORE_UNAVAILABLE'},503);
    const id=crypto.randomUUID(); const receiptKey='leo:integration-read:'+id;
    const receipt={id,platform,query,startedAt:new Date().toISOString(),status:'STARTED',mode:'READ_ONLY'};
    await env.COMMERCE.put(receiptKey,JSON.stringify(receipt),{expirationTtl:2592000});
    activeReceipt={key:receiptKey,value:receipt};
    let items,meta;
    if(platform==='freelancer') {
      const url=new URL('https://www.freelancer.com/api/projects/0.1/projects/active/');
      url.searchParams.set('query',query); url.searchParams.set('limit','10');
      const data=await integrationProvider(url.href,{headers});
      if(!Array.isArray(data.result?.projects)) throw Error('PROVIDER_RESPONSE_INVALID');
      items=data.result.projects.slice(0,10).map(p=>({id:String(p.id||''),title:integrationText(p.title),
        url:/^[-a-zA-Z0-9_/]{3,250}$/.test(p.seo_url||'')?'https://www.freelancer.com/projects/'+p.seo_url.replace(/^projects\//,''):null,
        budget:p.budget?{minimum:p.budget.minimum,maximum:p.budget.maximum,currency:p.currency?.code}:null}));
    } else if(platform==='upwork') {
      ({items,meta}=await upworkRead(env,'search',query));
    } else {
      // Fixed first page, at most ten companies, no enrichment/dedup/paid pagination.
      // Provider docs: this request is within the free result zone; never retry 402/429.
      const data=await integrationProvider('https://api.explee.com/public/api/v1/search/companies',{
        method:'POST',headers,body:JSON.stringify({filters:{definition:query},page:1,page_size:10})});
      if(!Array.isArray(data.companies)||!data.meta) throw Error('PROVIDER_RESPONSE_INVALID');
      meta={creditsCharged:data.meta.credits_charged};
      items=data.companies.slice(0,10).map(c=>({title:integrationText(c.name),domain:integrationText(c.domain),description:integrationText(c.description)}));
    }
    await env.COMMERCE.put(receiptKey,JSON.stringify({...receipt,status:'COMPLETED',completedAt:new Date().toISOString(),count:items.length,meta}),{expirationTtl:2592000});
    return integrationJSON({success:true,platform,items,meta,receiptId:id,mode:'READ_ONLY',authorizedActions:[]});
  } catch(error) {
    const known=['UPWORK_ACTION_NOT_ALLOWED','UPWORK_AUTHORIZATION_REQUIRED','UPWORK_REAUTHORIZATION_REQUIRED','UPWORK_AUTH_STORAGE_MISSING','UPWORK_OWNER_KEY_MISSING',
      'UPWORK_CONNECT_RESPONSE_INVALID','UPWORK_MCP_RESPONSE_INVALID','UPWORK_MCP_REJECTED','UPWORK_MCP_PROTOCOL_UNSUPPORTED',
      'UPWORK_TOOL_REJECTED','UPWORK_TOOL_RESPONSE_INVALID','UPWORK_SEARCH_RESPONSE_INVALID','UPWORK_RESPONSE_TOO_LARGE'];
    const code=/^(PROVIDER_HTTP_\d{3}|PROVIDER_REJECTED|PROVIDER_RESPONSE_INVALID|UPWORK_(TOKEN|MCP)_HTTP_\d{3})$/.test(error.message) || known.includes(error.message)
      ? error.message : 'INTEGRATION_REQUEST_FAILED';
    const providerReason=['EDGE_ACCESS_DENIED','API_KEY_REJECTED','ACCESS_DENIED_UNCLASSIFIED'].includes(error.providerReason) ? error.providerReason : undefined;
    if(activeReceipt) try {await env.COMMERCE.put(activeReceipt.key,JSON.stringify({...activeReceipt.value,status:'FAILED',error:code,completedAt:new Date().toISOString()}),{expirationTtl:2592000});} catch {}
    return integrationJSON({success:false,platform,error:code,providerReason},502);
  }
}

// Direct Upload compatibility layer for the original Pages address.
// Retain this immutable deployment: it owns the existing API and its bindings.
export const BACKEND_HOST = 'e912df66.boltech-group.pages.dev';
export const LEO_VOICE = 'es-SV-LorenaNeural';
export const VOICE_PROFILE = 'lorena-gentle-v1';
export const WELCOME = {es:'Hola, soy Leo. Qué gusto saludarte. Cuéntame, ¿en qué te puedo ayudar?',en:'Hi, I’m Leo. It’s lovely to meet you. Tell me, how can I help?'};
const xml = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
async function speech(request, env) {
  const fail = (error, status) => Response.json({success:false,error}, {status,headers:{'Cache-Control':'no-store'}});
  if (request.method !== 'POST') return fail('METHOD_NOT_ALLOWED',405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return fail('ORIGIN_NOT_ALLOWED',403);
  if (!env.AZURE_SPEECH_KEY || !/^[a-z0-9-]+$/.test(env.AZURE_SPEECH_REGION || '')) return fail('SPEECH_NOT_CONFIGURED',503);
  if (Number(request.headers.get('Content-Length')) > 6000) return fail('TEXT_TOO_LONG',413);
  let data;
  try { const raw = await request.text(); if(raw.length > 6000) return fail('TEXT_TOO_LONG',413); data=JSON.parse(raw); }
  catch { return fail('INVALID_JSON',400); }
  const text = typeof data.text === 'string' ? data.text.replace(/[*_`#]/g,'').trim() : '';
  if (!text || text.length > 800) return fail('INVALID_TEXT_LENGTH',400);
  try {
    // Reuse the already configured Speech resource; no provider or subscription is created.
    const result = await fetch(`https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method:'POST', redirect:'manual', signal:AbortSignal.timeout(12000),
      headers:{'Ocp-Apim-Subscription-Key':env.AZURE_SPEECH_KEY,'Content-Type':'application/ssml+xml',
        'X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'Boltech-Leo'},
      body:`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-SV"><voice name="${LEO_VOICE}"><prosody rate="-8%" volume="-10%">${xml(text).replace(/([.!?])\s+/g, '$1<break time="180ms"/>')}</prosody></voice></speak>`
    });
    if(!result.ok) return fail('SPEECH_PROVIDER_HTTP_'+result.status,502);
    const audio=await result.arrayBuffer();
    if(!audio.byteLength || audio.byteLength > 2000000) return fail('INVALID_AUDIO',502);
    return new Response(audio,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Boltech-Voice-Id':LEO_VOICE,'X-Boltech-Voice-Profile':VOICE_PROFILE}});
  } catch { return fail('SPEECH_PROVIDER_UNAVAILABLE',502); }
}
// Only a first, greeting-only turn is handled here. Actual requests and ongoing
// conversations retain the existing backend and its authorization rules.
export async function firstGreeting(request) {
  if(Number(request.headers.get('Content-Length')) > 10000) return null;
  try {
    const raw=await request.clone().text();
    if(raw.length > 10000) return null;
    const data=JSON.parse(raw);
    if(!data || typeof data.message !== 'string' || data.message.length > 120 ||
       (data.history !== undefined && (!Array.isArray(data.history) || data.history.length))) return null;
    const normalized=data.message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[¿?¡!.,;:]/g,' ').replace(/\s+/g,' ').trim();
    if(!/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hi|hello|hey)( leo)?( como estas| que tal| how are you)?$/.test(normalized)) return null;
    return Response.json({success:true,mode:'WELCOME',reply:WELCOME[data.language==='en'?'en':'es'],
      authorizedActions:[],qualified:false,provider:'boltech-welcome'}, {headers:{'Cache-Control':'no-store'}});
  } catch { return null; }
}
const LEO_PATHS = new Set(['/sales-agent', '/sales-agent.html', '/sales-agent/']);

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if(['/api/upwork/client-metadata','/api/upwork/start','/api/upwork/callback'].includes(incoming.pathname)) return handleUpworkOAuth(request,env,integrationAuthorized);
    if(incoming.pathname === '/api/leo-integrations') return handleLeoIntegrations(request,env);
    if(incoming.pathname === '/api' && incoming.searchParams.get('leo_sales') === '1' && request.method === 'POST') {
      const greeting=await firstGreeting(request); if(greeting) return greeting;
    }
    if (incoming.pathname === '/api' && incoming.searchParams.get('leo_speech') === '1' && request.method === 'POST') return speech(request,env);
    if (['GET', 'HEAD'].includes(request.method) && LEO_PATHS.has(incoming.pathname)) {
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Boltech-Leo-Release', 'gentle-20261110');
      return response;
    }
    // Never resolve user-controlled paths against the host or follow redirects
    // with a customer's Authorization header or signed payment payload.
    const target = new URL(request.url);
    target.protocol = 'https:';
    target.hostname = BACKEND_HOST;
    target.port = '';
    const headers = new Headers(request.headers);
    for (const name of ['host', 'connection', 'x-forwarded-host', 'x-forwarded-for']) headers.delete(name);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) headers.set('x-forwarded-for', ip);
    try {
      const upstream = await fetch(target, {
        method: request.method, headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual'
      });
      const response = new Response(upstream.body, upstream);
      response.headers.set('X-Boltech-Backend-Release', 'e912df66');
      // Keep same-site canonical redirects on the visitor's current origin.
      const location = response.headers.get('Location');
      if (location) {
        const redirect = new URL(location, target);
        if (redirect.hostname === BACKEND_HOST) {
          redirect.host = incoming.host;
          response.headers.set('Location', redirect.href);
        }
      }
      return response;
    } catch {
      return Response.json({ success: false, error: 'BOLTECH_PAGES_BACKEND_UNREACHABLE' }, {
        status: 502, headers: { 'Cache-Control': 'no-store' }
      });
    }
  }
};

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

import {upworkRead} from './upwork.mjs';
import {upworkConfiguration, handleUpworkOAuth} from './upwork-oauth.mjs';
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

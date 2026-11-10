// Direct Upload compatibility layer for the original Pages address.
// Retain this immutable deployment: it owns the existing API and its bindings.
export const BACKEND_HOST = 'e912df66.boltech-group.pages.dev';
export const LEO_VOICE = 'es-SV-LorenaNeural';
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
      method:'POST', redirect:'error', signal:AbortSignal.timeout(12000),
      headers:{'Ocp-Apim-Subscription-Key':env.AZURE_SPEECH_KEY,'Content-Type':'application/ssml+xml',
        'X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'Boltech-Leo'},
      body:`<speak version="1.0" xml:lang="es-SV"><voice name="${LEO_VOICE}">${xml(text)}</voice></speak>`
    });
    if(!result.ok) return fail('SPEECH_PROVIDER_FAILED',502);
    const audio=await result.arrayBuffer();
    if(!audio.byteLength || audio.byteLength > 2000000) return fail('INVALID_AUDIO',502);
    return new Response(audio,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Boltech-Voice-Id':LEO_VOICE}});
  } catch { return fail('SPEECH_PROVIDER_UNAVAILABLE',502); }
}
const LEO_PATHS = new Set(['/sales-agent', '/sales-agent.html', '/sales-agent/']);

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname === '/api' && incoming.searchParams.get('leo_speech') === '1' && request.method === 'POST') return speech(request,env);
    if (['GET', 'HEAD'].includes(request.method) && LEO_PATHS.has(incoming.pathname)) {
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Boltech-Leo-Release', 'audio-20261110');
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

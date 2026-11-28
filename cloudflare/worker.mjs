import { handleLeoNativeChat, leoChatReadiness } from './leo-native-chat.mjs';
// The production API was migrated to Cloudflare Pages independently of Git.
// Preserve its deployed handlers and secret store; never fall back to Vercel.
const API_ORIGIN = 'https://boltech-group.pages.dev';

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname !== '/api' && !incoming.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    // Normalize historical frontend aliases to the deployed Cloudflare contract.
    if (incoming.pathname === '/api/index' || incoming.pathname === '/api/index.js') {
      incoming.pathname = '/api';
    }
    if (incoming.searchParams.get('rodrigo_speech') === '1') {
      incoming.searchParams.delete('rodrigo_speech');
      incoming.searchParams.set('leo_speech', '1');
    }
    // Public advisor is isolated from legacy commerce and payment routes.
    if (incoming.pathname === '/api/leo-advisor-status' && request.method === 'GET') {
      return Response.json(leoChatReadiness(env), {headers:{'Cache-Control':'no-store'}});
    }
    if (incoming.pathname === '/api/leo-advisor-chat') {
      return handleLeoNativeChat(request, env);
    }
    // Explicitly consented public inquiry, isolated from payment and legacy lead routes.
    if (incoming.pathname === '/api/leo-advisor-intake') {
      const json=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
      if(request.method!=='POST')return json({success:false,error:'METHOD_NOT_ALLOWED'},405);
      if(request.headers.get('Origin')!==incoming.origin)return json({success:false,error:'ORIGIN_NOT_ALLOWED'},403);
      try {
        if(Number(request.headers.get('Content-Length'))>6000)return json({success:false,error:'REQUEST_TOO_LARGE'},413);
        const raw=await request.text();if(raw.length>6000)return json({success:false,error:'REQUEST_TOO_LARGE'},413);
        const data=JSON.parse(raw);
        if(!data||data.consent!==true||data.website!==''||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.requestId||''))||
          typeof data.need!=='string'||data.need.trim().length<12||data.need.length>900||
          typeof data.contact!=='string'||!data.contact.trim()||data.contact.length>120||
          typeof data.company!=='string'||!data.company.trim()||data.company.length>120||
          typeof data.email!=='string'||data.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return json({success:false,error:'INVALID_INQUIRY'},400);
        const upstream=await fetch(API_ORIGIN+'/api/leo-public-intake',{method:'POST',redirect:'error',
          headers:{'Content-Type':'application/json','Origin':API_ORIGIN},signal:AbortSignal.timeout(20000),
          body:JSON.stringify({requestId:data.requestId,need:data.need,contact:data.contact,company:data.company,email:data.email,language:data.language==='en'?'en':'es',consent:true,website:''})});
        const body=await upstream.json();
        if(!upstream.ok||body.success!==true)return json({success:false,error:'INTAKE_UNAVAILABLE'},503);
        if(body.persistence!=='SUPABASE_CONFIRMED')return json({success:false,error:'INTAKE_NOT_CONFIRMED',retry:true},503);
        return json({success:true,reference:body.reference,persistence:'SUPABASE_CONFIRMED'},200);
      }catch{return json({success:false,error:'INTAKE_UNAVAILABLE'},503);}
    }
    // Set the origin after parsing: paths such as /api//host cannot change it.
    const target = new URL(incoming.pathname + incoming.search, API_ORIGIN);
    target.protocol = 'https:';
    target.host = 'boltech-group.pages.dev';
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('x-forwarded-host');
    // Never let the caller forge the IP consumed by the existing rate limiter.
    headers.delete('x-forwarded-for');
    const clientIP = request.headers.get('CF-Connecting-IP');
    if (clientIP) headers.set('x-forwarded-for', clientIP);
    try {
      const upstream = await fetch(target, {
        method:request.method,
        headers,
        body:['GET','HEAD'].includes(request.method) ? undefined : request.body,
        redirect:'manual'
      });
      const response = new Response(upstream.body, upstream);
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Boltech-API-Origin', 'cloudflare-pages');
      return response;
    } catch {
      return Response.json({success:false,error:'BOLTECH_API_UNREACHABLE'}, {
        status:502, headers:{'Cache-Control':'no-store'}
      });
    }
  }
};

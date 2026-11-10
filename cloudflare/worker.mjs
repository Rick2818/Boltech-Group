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

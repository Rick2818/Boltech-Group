// Keep the existing API and secret store during the frontend migration.
// A static-assets deployment cannot execute the Vercel /api handlers.
const API_ORIGIN = 'https://boltech-group.vercel.app';

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname !== '/api' && !incoming.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    // Set the origin after parsing: paths such as /api//host cannot change it.
    const target = new URL(incoming.pathname + incoming.search, API_ORIGIN);
    target.protocol = 'https:';
    target.host = 'boltech-group.vercel.app';
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
      response.headers.set('X-Boltech-API-Origin', 'vercel');
      return response;
    } catch {
      return Response.json({success:false,error:'BOLTECH_API_UNREACHABLE'}, {
        status:502, headers:{'Cache-Control':'no-store'}
      });
    }
  }
};

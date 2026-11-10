// Direct Upload compatibility layer for the original Pages address.
// Retain this immutable deployment: it owns the existing API and its bindings.
export const BACKEND_HOST = 'e912df66.boltech-group.pages.dev';
const LEO_PATHS = new Set(['/sales-agent', '/sales-agent.html', '/sales-agent/']);

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
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

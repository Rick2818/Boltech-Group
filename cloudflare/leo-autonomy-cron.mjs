// Scheduler Worker: public HTTP requests never execute autonomous tasks.
export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const headers = { 'Cache-Control': 'no-store' };
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    }
    if (!['/', '/health'].includes(path)) return new Response(null, { status: 404, headers });
    headers['Content-Type'] = 'application/json';
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({
      service: 'boltech-leo-autonomy-cron', mode: 'scheduled-only',
      engineHealth: 'not-checked'
    }), { headers });
  },
  async scheduled(controller, env, ctx) {
    const base = String(env.LEO_APP_URL || '').replace(/\/$/, '');
    const token = String(env.LEO_PLATFORM_TOKEN || '').trim();
    if (!base || !token) throw new Error('LEO_CRON_CONFIGURATION_REQUIRED');
    ctx.waitUntil(Promise.allSettled([fetch(base + '/api/leo-autonomy-worker', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'tick', limit: 4, source: 'cloudflare-cron' }),
      redirect: 'error'
    }).then(async (response) => {
      if (!response.ok) throw new Error('LEO_CRON_WORKER_HTTP_' + response.status);
    }), ...(env.LEO_PIPELINE_ENABLED==='true'?[fetch(base+'/api/leo-pipeline-tick',{method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(25000)
    }).then(async response=>{const result=await response.json();if(!response.ok||result.success!==true)throw Error('LEO_PIPELINE_TICK_FAILED');})]:[])
    ]).then(results=>{if(results.some(r=>r.status==='rejected'))throw Error('LEO_SCHEDULED_TASK_FAILED');}));
  }
};


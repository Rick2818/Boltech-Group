import { apolloError } from './apollo_client.js';

export function createApolloCrmQueue({ token = process.env.PARTNER_API_TOKEN, fetcher = fetch } = {}) {
  let ready = false;
  async function call(body) {
    if (!String(token || '').trim()) throw apolloError('APOLLO_CRM_AUTH_NOT_CONFIGURED');
    let response, data;
    try {
      response = await fetcher('https://boltech-group.vercel.app/api/crm', {
        method: body ? 'POST' : 'GET', redirect: 'error', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
      data = await response.json();
    } catch { throw apolloError('APOLLO_CRM_NETWORK_ERROR', true); }
    if (!response.ok) throw apolloError('APOLLO_CRM_REQUEST_FAILED', response.status >= 500);
    return data;
  }
  return async fields => {
    if (!ready) {
      const config = await call();
      if (!config.integrations?.hubspot?.configured) throw apolloError('APOLLO_CRM_NOT_CONFIGURED');
      if (config.integrations?.salesforce?.configured) throw apolloError('APOLLO_SECONDARY_CRM_REVIEW_REQUIRED');
      ready = true;
    }
    const data = await call(fields);
    return data.data?.hubspot;
  };
}

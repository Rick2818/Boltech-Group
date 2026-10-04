import { createApolloClient, getApolloApiKey, apolloError, validateApolloEmail } from './apollo_client.js';
import { syncApolloContacts } from './apollo_pipeline.js';
import { requireOperationalAuth } from './operational_auth.js';

export const config = { maxDuration: 60 };
export function createApolloHandler({ client = createApolloClient(), queue = async lead => {
  const { queueContactSync } = await import('./crm_recovery.js');
  return queueContactSync(lead);
}, validateEmail = validateApolloEmail } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!requireOperationalAuth(req, res)) return;
    const url = new URL(req.url, 'https://boltech-group.vercel.app');
    const action = req.query?.action || url.searchParams.get('action') || 'readiness';
    const operation = action.replace(/^apollo-/, '');
    try {
      if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' });
      if (req.method === 'GET' && operation === 'readiness') return res.status(200).json({ success: true,
        apollo: { configured: Boolean(getApolloApiKey()), connected: null, enrichmentEnabled: false, revision: 'apollo-hardening-v1' },
        crm: { configured: Boolean(String(process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY || '').trim()) } });
      if (req.method === 'GET' && operation === 'verify') {
        const perPage = Number(url.searchParams.get('perPage') || 100);
        const batch = await client.listSavedContacts({ perPage, maxPages: 5 });
        const validation = batch.contacts.length ? await validateEmail(batch.contacts[0].contactEmail) : null;
        return res.status(200).json({ success: true, complete: batch.complete, pagesRead: batch.pagesRead,
          providerTotal: batch.totalEntries, usableContacts: batch.contacts.length, rejected: batch.rejected,
          sampleContactId: batch.contacts[0]?.apolloContactId || null, emailValidation: validation, observedAt: batch.observedAt });
      }
      if (req.method === 'POST' && operation === 'sync') {
        if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})) > 4096) throw apolloError('APOLLO_INVALID_INPUT');
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const ids = body?.contactIds;
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 1 || new Set(ids).size !== ids.length ||
            ids.some(id => !/^[a-f0-9]{24}$/.test(id))) throw apolloError('APOLLO_INVALID_INPUT');
        const batch = await client.listSavedContacts({ perPage: 100, maxPages: 5 });
        const selected = ids.map(id => batch.contacts.find(c => c.apolloContactId === id));
        if (selected.some(c => !c)) throw apolloError('APOLLO_CONTACT_NOT_FOUND');
        for (const contact of selected) {
          if (!(await validateEmail(contact.contactEmail)).mx) throw apolloError('APOLLO_EMAIL_NO_MX');
        }
        const result = await syncApolloContacts(selected, queue);
        return res.status(result.providerConfirmed === result.submitted ? 200 : 202).json({ success: result.providerConfirmed === result.submitted, queued: result.providerConfirmed < result.submitted, ...result });
      }
      return res.status(400).json({ success: false, code: 'APOLLO_INVALID_ACTION' });
    } catch (error) {
      const code = /^[A-Z_]+$/.test(error.code || '') ? error.code : 'APOLLO_REQUEST_FAILED';
      if (error.retryAfterMs) res.setHeader('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
      const badInput = /INVALID_INPUT|INVALID_ACTION|CONTACT_NOT_FOUND/.test(code) || error instanceof SyntaxError;
      return res.status(badInput ? 400 : 503).json({ success: false, code, retryable: error.retryable === true });
    }
  };
}
export default createApolloHandler();

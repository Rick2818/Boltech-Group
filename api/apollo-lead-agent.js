import { requireOperationalAuth } from '../lib/operational_auth.js';
import { createApolloClient } from '../lib/apollo_client.js';

// Private, read-only handoff to the lead agent. No enrichment, purchases or sends.
export const config = { maxDuration: 30 };

export default async function apolloLeadAgent(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireOperationalAuth(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' });
  }
  const keyConfigured = Boolean(String(process.env.APOLLO_API_KEY || '').trim());
  const mode = String(req.query?.mode || 'status');
  if (mode === 'status') return res.status(200).json({
    success: true, integration: 'APOLLO_LEAD_AGENT', apiKeyConfigured: keyConfigured,
    operation: 'READ_ONLY', sendsEnabled: false, creditConsumingOperationsEnabled: false
  });
  if (mode !== 'saved-contacts') return res.status(400).json({ success: false, code: 'INVALID_MODE' });
  if (!keyConfigured) return res.status(503).json({ success: false, code: 'APOLLO_NOT_CONFIGURED' });
  try {
    // Small bounded read; never claim that saved contacts are verified prospects.
    const batch = await createApolloClient({ apiKey: process.env.APOLLO_API_KEY }).listSavedContacts({
      perPage: 25, maxPages: 1, budgetMs: 20000
    });
    return res.status(200).json({
      success: true, source: 'APOLLO_SAVED_CONTACT',
      leads: batch.contacts.map(contact => ({ ...contact, contactEligible: false, researchOnly: true })),
      complete: batch.complete, observedAt: batch.observedAt,
      emailSendingAuthorized: false
    });
  } catch (error) {
    const code = String(error?.code || '');
    return res.status(503).json({
      success: false, code: /^APOLLO_[A-Z_]+$/.test(code) ? code : 'APOLLO_REQUEST_UNCONFIRMED'
    });
  }
}

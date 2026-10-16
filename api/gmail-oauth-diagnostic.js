import { requireOperationalAuth } from '../lib/operational_auth.js';
import { createSdrGmail } from '../lib/sdr_gmail.js';

// Read-only diagnostic. No token, credential, response body or email is logged.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ success:false, code:'METHOD_NOT_ALLOWED' });
  if (!requireOperationalAuth(req, res)) return;
  try {
    const result = await createSdrGmail().verify();
    return res.status(200).json({success:true, oauth:'PASS', gmail:'PASS', senderVerified:result.verified});
  } catch (error) {
    const allow = new Set(['GMAIL_OAUTH_NOT_CONFIGURED','GMAIL_OAUTH_NETWORK_ERROR','GMAIL_OAUTH_AUTH_FAILED','GMAIL_OAUTH_INVALID_RESPONSE','GMAIL_READ_UNAVAILABLE','GMAIL_API_REJECTED','GMAIL_SENDER_MISMATCH','GMAIL_RATE_LIMITED','GMAIL_INVALID_RESPONSE']);
    return res.status(503).json({success:false, oauth:'FAIL', code:allow.has(error?.code)?error.code:'GMAIL_DIAGNOSTIC_FAILED'});
  }
}

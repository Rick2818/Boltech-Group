import crypto from 'node:crypto';

// Administrative diagnostics only. Never reuse a partner's A2A credential here.
export function requireOperationalAuth(req, res) {
  const expected = String(process.env.PARTNER_API_TOKEN || process.env.COCKPIT_ACCESS_TOKEN || '').trim();
  const auth = String(req.headers?.authorization || '');
  const supplied = /^Bearer /i.test(auth) ? auth.slice(7).trim() : '';
  res.setHeader('Cache-Control', 'no-store');
  if (!expected) {
    res.status(503).json({ success: false, code: 'OPERATIONAL_AUTH_NOT_CONFIGURED' });
    return false;
  }
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (!a.length || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ success: false, code: 'OPERATIONAL_AUTH_REQUIRED' });
    return false;
  }
  return true;
}

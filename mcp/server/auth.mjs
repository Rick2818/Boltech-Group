import { timingSafeEqual } from 'node:crypto';

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function authorizeMcpRequest(req) {
  const configured = process.env.BOLTECH_MCP_API_KEY;
  if (!configured) {
    return { ok: false, status: 503, code: 'MCP_AUTH_NOT_CONFIGURED' };
  }

  const raw = req.headers?.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  if (!match || !safeEqual(match[1], configured)) {
    return { ok: false, status: 401, code: 'MCP_UNAUTHORIZED' };
  }

  return { ok: true };
}

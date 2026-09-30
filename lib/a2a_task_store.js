import crypto from 'node:crypto';

export function taskIdentity(partnerId, messageId) {
  return crypto.createHash('sha256').update(JSON.stringify([partnerId, messageId])).digest('hex');
}

async function command(args) {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/$/, '');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url.startsWith('https://') || !token) throw new Error('A2A task storage is not configured');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('A2A task storage unavailable');
  const payload = await response.json();
  if (payload.error) throw new Error('A2A task storage failed');
  return payload.result;
}

function key(partnerId, taskId) { return `boltech:a2a:${partnerId}:${taskId}`; }

export async function readTask(partnerId, taskId) {
  const value = await command(['GET', key(partnerId, taskId)]);
  return value ? JSON.parse(value) : null;
}

export async function claimTask(partnerId, taskId, fingerprint) {
  // No expiry: a crashed/uncertain write must never become a second referral.
  const initial = { fingerprint, state: 'pending', startedAt: new Date().toISOString() };
  const result = await command(['SET', key(partnerId, taskId), JSON.stringify(initial), 'NX']);
  return result === 'OK' ? { claimed: true } : { claimed: false, existing: await readTask(partnerId, taskId) };
}

export async function completeTask(partnerId, taskId, fingerprint, task) {
  const result = await command(['SET', key(partnerId, taskId), JSON.stringify({ fingerprint, state: 'completed', task })]);
  if (result !== 'OK') throw new Error('A2A task completion could not be stored');
}

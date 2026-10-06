import { redisCommand } from './rsi_handoff_store.js';

// Durable one-confirmation claim. Unknown delivery never triggers a blind resend.
export async function confirmIntake({ requestId, recipient, send }, command = redisCommand) {
  const key = `boltech:intake:confirmation:${requestId}`;
  const intent = { state: 'SEND_PENDING', recipient, recordedAt: new Date().toISOString() };
  if (await command(['SET', key, JSON.stringify(intent), 'NX']) !== 'OK') {
    const raw = await command(['GET', key]);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved?.recipient !== recipient) throw new Error('INTAKE_CONFIRMATION_RECONCILE_REQUIRED');
    return saved.state === 'ACCEPTED' ? { ...saved.result, duplicate: true }
      : { success: false, acceptedByProvider: false, duplicate: true, deliveryStatus: saved.state || 'UNKNOWN' };
  }
  let result;
  try { result = await send(); }
  catch {
    await command(['SET', key, JSON.stringify({ ...intent, state: 'UNKNOWN' })]);
    return { success: false, acceptedByProvider: false, deliveryStatus: 'UNKNOWN' };
  }
  const accepted = result?.success === true && result?.acceptedByProvider === true;
  const stored = { ...intent, state: accepted ? 'ACCEPTED' : 'FAILED', result };
  if (await command(['SET', key, JSON.stringify(stored)]) !== 'OK') throw new Error('INTAKE_CONFIRMATION_WRITE_UNCONFIRMED');
  const reread = await command(['GET', key]);
  if (reread !== JSON.stringify(stored)) throw new Error('INTAKE_CONFIRMATION_WRITE_UNCONFIRMED');
  return result;
}

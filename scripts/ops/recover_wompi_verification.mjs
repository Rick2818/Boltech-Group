const base = 'https://boltech-group.vercel.app';
const token = process.env.PARTNER_API_TOKEN;
if (!token) throw new Error('Operational authentication is unavailable.');
const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
let ready = false;
for (let attempt = 0; attempt < 20; attempt++) {
  try {
    const response = await fetch(base + '/api/payments?action=readiness-internal', { headers, signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (response.ok && data.wompiRecoveryContractVersion === 2) { ready = true; break; }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 15000));
}
if (!ready) throw new Error('Recovery deployment was not ready; no reconciliation was attempted.');
const response = await fetch(base + '/api/payments?action=wompi-recover', {
  method: 'POST', headers, signal: AbortSignal.timeout(45000),
  body: JSON.stringify({
    orderId: 'Boltech - Prueba real USD 1 - 2026-10-05',
    fingerprint: 'WOMPI-REDIRECT:0755d4456a0ecd737bc77f8b7428bc9167966ee040b6c642ba9020793bd59faf'
  })
});
const data = await response.json();
console.log(JSON.stringify({ status: response.status, accepted: data.accepted === true, duplicate: data.duplicate === true, reason: data.reason || data.code || null }));
if (!response.ok || data.accepted !== true) throw new Error('Wompi recovery was not accepted. Inspect the payment ledger.');

// One-time repair of the failure identified by the production health report.
const repair = await fetch(base + '/api/telegram?action=repair-webhook', {
  method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(30000)
});
const telegram = await repair.json();
console.log(JSON.stringify({ telegramRepairStatus: repair.status, code: telegram.code || null }));
if (!repair.ok || telegram.ok !== true) throw new Error('Telegram webhook repair requires review.');

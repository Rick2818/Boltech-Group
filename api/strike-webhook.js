import { reconcileStrikeWebhook } from '../lib/payment_reconciliation.js';

function safeMessage(error) {
  return String(error?.message || error || 'error').slice(0, 500);
}

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('X-Webhook-Signature') || '';

  if (!rawBody || rawBody.length > 1024 * 1024) {
    return Response.json({ success: false, error: 'Invalid webhook body.' }, { status: 400 });
  }

  try {
    const result = await reconcileStrikeWebhook({ rawBody, signature });
    return Response.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    console.error('[STRIKE WEBHOOK]', error?.code || error?.name || 'ERROR', safeMessage(error));
    const status = Number(error?.statusCode) || 500;
    return Response.json({
      success: false,
      code: error?.code || 'STRIKE_WEBHOOK_ERROR',
      error: status >= 500 ? 'Webhook processing temporarily unavailable.' : 'Webhook rejected.'
    }, { status });
  }
}

export async function GET() {
  return Response.json({ success: false, error: 'Method not allowed.' }, { status: 405 });
}

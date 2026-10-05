import { dispatchUniversalEmail } from './universal_email_engine.js';
import { claimFulfillment, updateOrder } from './payment_store.js';

export async function fulfillPaidOrder(order) {
  if (!order || order.status !== 'PAID') {
    const err = new Error('Fulfillment requires a PAID order.');
    err.code = 'ORDER_NOT_PAID';
    throw err;
  }

  if (order.productId === 'payment-verification') {
    return { fulfilled: false, technicalTest: true, serviceDeliveryRequired: false };
  }

  const claim = await claimFulfillment(order.orderId, order.provider);
  if (!claim.claimed) {
    return { fulfilled: false, duplicate: true };
  }

  await updateOrder(order.orderId, { fulfillmentStatus: 'PROCESSING' });

  try {
    const result = await dispatchUniversalEmail({
      to: order.customerEmail,
      subject: `Pago confirmado por proveedor — Boltech Group [${order.orderId}]`,
      fromName: 'Boltech Group',
      preferredTransport: 'smtp',
      textBody: [
        'Boltech Group',
        '',
        'El proveedor de pago confirmó tu transacción.',
        `Orden: ${order.orderId}`,
        `Producto: ${order.productId}`,
        `Monto confirmado: $${Number(order.expectedAmountUsd).toFixed(2)} USD`,
        `Proveedor: ${order.provider}`,
        '',
        'El siguiente paso es la preparación o activación del servicio correspondiente.',
        '',
        'Contacto: ricardo.boltechgroup@gmail.com'
      ].join('\n')
    });

    if (!result?.success || result?.acceptedByProvider !== true) {
      throw new Error('Gmail SMTP did not provide provider acceptance evidence.');
    }

    await updateOrder(order.orderId, {
      fulfillmentStatus: 'COMPLETED',
      notes: `Payment confirmation email accepted by Gmail SMTP. ${String(result.providerResponse || '').slice(0, 500)}`
    });

    return {
      fulfilled: true,
      duplicate: false,
      emailDeliveryStatus: result.deliveryStatus || 'ACCEPTED_BY_PROVIDER'
    };
  } catch (error) {
    await updateOrder(order.orderId, {
      fulfillmentStatus: 'FAILED',
      notes: `Payment is PAID, but fulfillment notification failed: ${String(error?.message || error).slice(0, 700)}`
    });
    return {
      fulfilled: false,
      duplicate: false,
      error: String(error?.message || error)
    };
  }
}

import { queueContactSync } from './crm_recovery.js';

// Durable contact synchronization. No synthetic IDs, deals or notifications.
export async function syncInboundLeadToHubSpotAndExplee(leadData = {}) {
  const hubspot = await queueContactSync(leadData);
  return { timestamp: new Date().toISOString(), hubspot,
    explee: { success: false, indexed: false, status: 'NOT_SYNCED' } };
}

// A CRM stage is not provider-confirmed cash and cannot trigger fulfillment.
export async function handleHubSpotWebhookEvent(event = {}) {
  const value = event.propertyValue || event.value || event.stage;
  return { success: true, processed: true, isClosedWon: value === 'closedwon', paymentVerified: false };
}

import { createLeoOpportunity } from './factory_leo_crm.js';
import { createFactoryOrder } from './factory_order_registry.js';

// Private server-side orchestration: caller must provide identity verified by auth middleware.
// A saved opportunity is not an order. An order only exists if the second write succeeds.
export async function registerLeoRequest(db, identity, input) {
  if (!identity || identity.verified !== true) throw new Error('Verified identity required');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request');
  const { title, contactName, contactEmail, agentType, requestDetails } = input;
  const opportunity = await createLeoOpportunity(db, identity, { title, contactName, contactEmail });
  try {
    const order = await createFactoryOrder(db, identity, agentType, {
      ...(requestDetails ?? {}), opportunity_id: opportunity.id
    });
    return { opportunity, order, receipt: { orderNumber: order.order_number, status: order.status } };
  } catch (error) {
    // Never fabricate a receipt for partially completed workflows.
    throw new Error('Opportunity recorded, but order creation failed; reconciliation required', { cause: error });
  }
}

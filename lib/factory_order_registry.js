// Factory order registry for the prebuilt-agent product. No public endpoint here.
// Call only after server-side authentication has verified tenantId and customerId.
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,127}$/;
const ORDER = /^BOL-\d{4}-\d{6,}$/;
function trusted(ctx) {
  if (!ctx || ctx.verified !== true || !ID.test(ctx.tenantId || '') || !ID.test(ctx.customerId || '')) {
    throw new Error('Verified tenant and customer identity required');
  }
}
export async function createFactoryOrder(db, ctx, agentType, requestDetails = {}) {
  trusted(ctx);
  if (typeof agentType !== 'string' || !/^[a-zA-Z][a-zA-Z0-9 _-]{0,79}$/.test(agentType)) {
    throw new Error('Invalid agent type');
  }
  if (!requestDetails || Array.isArray(requestDetails) || typeof requestDetails !== 'object' ||
      JSON.stringify(requestDetails).length > 12000) throw new Error('Invalid request');
  const { data, error } = await db.from('factory_agent_orders')
    .insert({ tenant_id: ctx.tenantId, customer_id: ctx.customerId,
      agent_type: agentType, request_details: requestDetails })
    .select('id,order_number,status,created_at').single();
  if (error) throw new Error('Could not save the request');
  if (!data?.order_number) throw new Error('Order number was not generated');
  return data;
}
export async function findFactoryOrder(db, ctx, orderNumber) {
  trusted(ctx);
  if (typeof orderNumber !== 'string' || !ORDER.test(orderNumber)) throw new Error('Invalid order number');
  const { data, error } = await db.from('factory_agent_orders')
    .select('id,order_number,agent_type,status,created_at,updated_at')
    .eq('tenant_id', ctx.tenantId).eq('customer_id', ctx.customerId)
    .eq('order_number', orderNumber).maybeSingle();
  if (error) throw new Error('Could not retrieve the order');
  return data ?? null;
}

// CRM foundation for independently sold Leo instances.
// The caller must resolve the tenant and user on the trusted server, never from a browser body.
const VALID = /^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,127}$/;
function requireIdentity(identity) {
  if (!identity || identity.verified !== true || !VALID.test(identity.tenantId || '') ||
      !VALID.test(identity.customerId || '')) throw new Error('Verified identity required');
}
export async function createLeoOpportunity(db, identity, { title, contactName, contactEmail } = {}) {
  requireIdentity(identity);
  if (typeof title !== 'string' || title.trim().length < 3 || title.length > 200)
    throw new Error('Invalid opportunity title');
  if (contactName != null && (typeof contactName !== 'string' || contactName.length > 160))
    throw new Error('Invalid contact name');
  if (contactEmail != null && (typeof contactEmail !== 'string' || contactEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)))
    throw new Error('Invalid contact email');
  const { data, error } = await db.from('factory_leo_opportunities').insert({
    tenant_id: identity.tenantId, created_by: identity.customerId, title: title.trim(),
    contact_name: contactName ?? null, contact_email: contactEmail ?? null
  }).select('id,title,status,created_at').single();
  if (error || !data) throw new Error('Failed to register opportunity');
  return data;
}
export async function listLeoOpportunities(db, identity) {
  requireIdentity(identity);
  const { data, error } = await db.from('factory_leo_opportunities')
    .select('id,title,status,created_at').eq('tenant_id', identity.tenantId)
    .eq('created_by', identity.customerId).order('created_at',{ascending:false}).limit(50);
  if (error) throw new Error('Failed to retrieve opportunities');
  return data ?? [];
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFactoryOrder, findFactoryOrder } from '../lib/factory_order_registry.js';
const a = { verified: true, tenantId: 'company-a', customerId: 'customer-1' };
function db() {
  let row = null;
  return { from(table) {
    assert.equal(table, 'factory_agent_orders');
    const q = {
      insert(fields) { row = { ...fields, id: 'order-id', order_number: 'BOL-2026-000001', status: 'received', created_at: '2026-10-27T00:00:00Z' }; return q; },
      select() { return q; },
      eq(k, v) { this.filters ??= []; this.filters.push([k,v]); return q; },
      async single() { return { data: row, error: null }; },
      async maybeSingle() {
        return { data: this.filters?.every(([k,v]) => row?.[k] === v) ? row : null, error: null };
      }
    };
    return q;
  }};
}
test('creates traceable order and recovers it only for its owner', async () => {
  const store = db();
  const created = await createFactoryOrder(store,a,'Ventas',{ objective: 'qualify leads' });
  assert.equal(created.order_number,'BOL-2026-000001');
  assert.equal((await findFactoryOrder(store,a,created.order_number)).status,'received');
  assert.equal(await findFactoryOrder(store,{...a,tenantId:'company-b'},created.order_number),null);
  assert.equal(await findFactoryOrder(store,{...a,customerId:'customer-2'},created.order_number),null);
});
test('rejects anonymous, forged or malformed queries', async () => {
  await assert.rejects(createFactoryOrder(db(),{...a, verified:false},'Ventas'),/Verified/);
  await assert.rejects(findFactoryOrder(db(),a,'any'),/Invalid order/);
  await assert.rejects(createFactoryOrder(db(),a,'Ventas',[]),/Invalid request/);
});

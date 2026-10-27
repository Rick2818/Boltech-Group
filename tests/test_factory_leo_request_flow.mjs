import test from 'node:test';
import assert from 'node:assert/strict';
import { registerLeoRequest } from '../lib/factory_leo_request_flow.js';

const identity={verified:true,tenantId:'demo-company',customerId:'demo-user'};
function mockDb(failOrder=false) {
  const rows=[];
  return { rows, from(table) {
    let record;
    const chain={
      insert(item){ record={...item,id:'id-'+table,order_number:table==='factory_agent_orders'?'BOL-2026-000123':undefined,status:table==='factory_agent_orders'?'received':'new',created_at:'2026-10-27'};return chain; },
      select(){return chain;},
      async single(){if (table==='factory_agent_orders'&&failOrder)return {error:{message:'down'}};rows.push({table,record});return {data:record,error:null};}
    };return chain;
  }};
}
test('creates CRM opportunity and traceable order, no real messages',async()=>{
 const db=mockDb();
 const r=await registerLeoRequest(db,identity,{title:'Sales agent for factory',agentType:'Ventas',requestDetails:{goal:'leads'}});
 assert.equal(r.receipt.orderNumber,'BOL-2026-000123');
 assert.equal(r.order.status,'received');
 assert.equal(db.rows.length,2);
 assert.equal(db.rows[1].record.request_details.opportunity_id,r.opportunity.id);
 assert.equal(db.rows[0].record.tenant_id,identity.tenantId);
 assert.equal(db.rows[1].record.customer_id,identity.customerId);
});
test('never returns receipt for incomplete order and rejects unverified identity',async()=>{
 await assert.rejects(registerLeoRequest(mockDb(),{...identity,verified:false},{title:'Sales agent',agentType:'Ventas'}),/Verified/);
 await assert.rejects(registerLeoRequest(mockDb(true),identity,{title:'Sales agent',agentType:'Ventas'}),/reconciliation required/);
});

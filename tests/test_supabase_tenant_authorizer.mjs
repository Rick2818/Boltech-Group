import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseTenantAuthorizer} from '../lib/supabase_tenant_authorizer.js';
const token='a'.repeat(40);
const req={accessToken:token,orderId:'order-1',customerId:'customer-a',tenantId:'tenant-a'};
const make=(overrides={})=>createSupabaseTenantAuthorizer({
 supabaseAuth:{getUser:async()=>({data:{user:{id:'uid-a',email_confirmed_at:'2026-01-01'}}})},
 memberships:{findActive:async()=>({authUserId:'uid-a',orderId:'order-1',customerId:'customer-a',tenantId:'tenant-a',status:'active'})},
 ...overrides});
test('verified authenticated tenant may run its own order',async()=>{
 const r=await make()(req);assert.equal(r.authorized,true);assert.equal(r.authUserId,'uid-a');
});
test('wrong customer and tenant are denied',async()=>{
 const check=make();assert.equal((await check({...req,customerId:'customer-b'})).authorized,false);
 assert.equal((await check({...req,tenantId:'tenant-b'})).authorized,false);
});
test('unconfirmed identity and revoked membership are denied',async()=>{
 const unconfirmed=make({supabaseAuth:{getUser:async()=>({data:{user:{id:'uid-a'}}})}});
 assert.equal((await unconfirmed(req)).authorized,false);
 const revoked=make({memberships:{findActive:async()=>({authUserId:'uid-a',orderId:'order-1',customerId:'customer-a',tenantId:'tenant-a',status:'revoked'})}});
 assert.equal((await revoked(req)).authorized,false);
});
test('failed identity provider and absent access token fail closed',async()=>{
 const broken=make({supabaseAuth:{getUser:async()=>{throw Error('unavailable')}}});
 assert.equal((await broken(req)).authorized,false);
 assert.equal((await make()({...req,accessToken:null})).authorized,false);
});

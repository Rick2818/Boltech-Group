// Boltech-only provider for Supabase Auth and tenant membership.
// Requires the tenant memberships migration before activation.
import {createClient} from '@supabase/supabase-js';
import {createSupabaseTenantAuthorizer} from './supabase_tenant_authorizer.js';
export function createBoltechTenantAuthorizer({url,anonKey,serviceRoleKey,clientFactory=createClient}={}){
 if(!url||!anonKey||!serviceRoleKey)throw Error('TENANT_SUPABASE_CONFIG_REQUIRED');
 const authClient=clientFactory(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const server=clientFactory(url,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
 return createSupabaseTenantAuthorizer({
  supabaseAuth:authClient.auth,
  memberships:{async findActive({authUserId,orderId,tenantId}){
   const {data,error}=await server.from('agent_tenant_memberships')
     .select('auth_user_id,order_id,tenant_id,customer_id,status')
     .eq('auth_user_id',authUserId).eq('order_id',orderId)
     .eq('tenant_id',tenantId).eq('status','active').maybeSingle();
   if(error)throw error;
   return data&&{authUserId:data.auth_user_id,orderId:data.order_id,
     tenantId:data.tenant_id,customerId:data.customer_id,status:data.status};
  }}
 });
}

// Server-only authorization using verified Supabase Auth identity and an independent
// tenant membership resolver. Never authorize from customer/tenant IDs supplied by a caller.
const deny=()=>({authorized:false});
export function createSupabaseTenantAuthorizer({supabaseAuth,memberships}={}){
 if(typeof supabaseAuth?.getUser!=='function'||typeof memberships?.findActive!=='function')
   throw Error('TENANT_AUTH_PROVIDERS_REQUIRED');
 return async function authorize({accessToken,orderId,customerId,tenantId}={}){
   if(typeof accessToken!=='string'||accessToken.length<20||typeof orderId!=='string'||
      typeof customerId!=='string'||typeof tenantId!=='string')return deny();
   let user;
   try{({data:{user}}=await supabaseAuth.getUser(accessToken));}catch{return deny();}
   if(!user?.id||!user.email_confirmed_at)return deny();
   let membership;
   try{membership=await memberships.findActive({authUserId:user.id,orderId,tenantId});}
   catch{return deny();}
   if(!membership||membership.authUserId!==user.id||membership.tenantId!==tenantId||
      membership.orderId!==orderId||membership.customerId!==customerId||
      membership.status!=='active')return deny();
   return {authorized:true,customerId,tenantId,authUserId:user.id};
 };
}

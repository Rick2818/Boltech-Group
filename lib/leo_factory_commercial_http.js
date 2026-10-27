import { createClient } from '@supabase/supabase-js';
import { verifyLeoTenantToken } from './leo_tenant_auth.js';
import { registerLeoRequest } from './factory_leo_request_flow.js';
import { findFactoryOrder } from './factory_order_registry.js';
import { listLeoOpportunities } from './factory_leo_crm.js';

export async function handleLeoFactoryCommercial(req,res,{verify=verifyLeoTenantToken,clientFactory=createClient}={}) {
  res.setHeader('Cache-Control','no-store');
  if (req.method!=='POST') return res.status(405).json({success:false,error:'METHOD_NOT_ALLOWED'});
  if (Number(req.headers['content-length']||0)>14000) return res.status(413).json({success:false,error:'PAYLOAD_TOO_LARGE'});
  try {
    const token=String(req.headers.authorization||'').replace(/^Bearer /i,'');
    const principal=verify(token);
    if(!principal?.verified || !principal.tenantId || !principal.subject) throw Object.assign(new Error('LEO_AUTH_UNVERIFIED'),{statusCode:401});
    const url=process.env.LEO_FACTORY_SUPABASE_URL;
    const key=process.env.LEO_FACTORY_SUPABASE_SECRET_KEY;
    if(!url || !key) throw Object.assign(new Error('LEO_CRM_NOT_CONFIGURED'),{statusCode:503});
    const db=clientFactory(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const identity={verified:true,tenantId:principal.tenantId,customerId:principal.subject};
    const b=req.body;
    if(!b || typeof b!=='object'||Array.isArray(b)) return res.status(400).json({success:false,error:'INVALID_BODY'});
    let result;
    if(b.operation==='create_request') result=await registerLeoRequest(db,identity,b.request);
    else if(b.operation==='find_order') result=await findFactoryOrder(db,identity,b.orderNumber);
    else if(b.operation==='list_opportunities') result=await listLeoOpportunities(db,identity);
    else return res.status(400).json({success:false,error:'UNSUPPORTED_OPERATION'});
    return res.status(200).json({success:true,result});
  }catch(e){
    const safe=e.statusCode===401?'LEO_AUTH_UNVERIFIED':e.message==='LEO_CRM_NOT_CONFIGURED'?'LEO_CRM_NOT_CONFIGURED':'LEO_COMMERCIAL_UNAVAILABLE';
    return res.status(e.statusCode===401?401:e.statusCode===503?503:400).json({success:false,error:safe});
  }
}

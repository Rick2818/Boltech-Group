import {verifyLeoTenantToken} from './leo_tenant_auth.js';
import {createLeoTenantAgent} from './leo_tenant_autonomy.js';
import {createLeoRedisStore} from './leo_redis_store.js';
const fail=(code,statusCode=400)=>{throw Object.assign(new Error(code),{statusCode})};
export async function handleLeoObjective(req,res,{store=createLeoRedisStore()}={}){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(Number(req.headers['content-length']||0)>9000)return res.status(413).json({error:'BODY_TOO_LARGE'});
 try {
 const token=String(req.headers.authorization||'').replace(/^Bearer /i,'');
 const principal=verifyLeoTenantToken(token);
 const b=req.body||{};
 if(typeof b!=='object'||Array.isArray(b))fail('LEO_INPUT_INVALID');
 // Only a tenant-scoped, read-only inspection is exposed. No outreach or writes.
 const tools={inspect_objective:{readOnly:true,run:async({tenantId,input})=>{
  const id=String(input?.id||'');
  if(!/^[A-Za-z0-9_-]{3,100}$/.test(id))fail('LEO_OBJECTIVE_ID_INVALID');
  const record=await store.read('leo:v1:'+tenantId+':'+id);
  if(!record||record.tenantId!==tenantId||record.owner!==principal.subject&&!principal.roles?.includes('tenant_admin'))fail('LEO_OBJECTIVE_NOT_ACCESSIBLE',403);
  return {ok:true,receipt:'leo-inspect:'+id+':v'+record.version};
 }}};
 const agent=createLeoTenantAgent({store,principal,tools});
 let result;
 if(b.operation==='create')result=await agent.objective(b.objective);
 else if(b.operation==='read')result=await agent.get(b.id);
 else if(b.operation==='transition'&&['plan','approve','block','execute','complete'].includes(b.input?.action))result=await agent.transition(b.input);
 else fail('LEO_OPERATION_NOT_AVAILABLE');
 return res.status(200).json({success:true,record:result});
 }catch(e){return res.status(e.statusCode||503).json({success:false,error:e.message==='LEO_AUTH_UNVERIFIED'?'LEO_AUTH_UNVERIFIED':e.message||'LEO_UNAVAILABLE'})}
}

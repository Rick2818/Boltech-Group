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
 const agent=createLeoTenantAgent({store,principal});
 let result;
 if(b.operation==='create')result=await agent.objective(b.objective);
 else if(b.operation==='read')result=await agent.get(b.id);
 else if(b.operation==='transition'&&['plan','approve','block'].includes(b.input?.action))result=await agent.transition(b.input);
 else fail('LEO_OPERATION_NOT_AVAILABLE');
 return res.status(200).json({success:true,record:result});
 }catch(e){return res.status(e.statusCode||503).json({success:false,error:e.message==='LEO_AUTH_UNVERIFIED'?'LEO_AUTH_UNVERIFIED':e.message||'LEO_UNAVAILABLE'})}
}

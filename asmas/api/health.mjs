export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 const e=process.env;
 if(e.ASMAS_ENV!=='staging'||e.ASMAS_OUTBOUND_ENABLED!=='false'||e.ASMAS_PAYMENTS_ENABLED!=='false'||e.ASMAS_SUPABASE_PROJECT_REF!=='pkgztteqtyebsggxnett')return res.status(503).json({project:'ASMAS',status:'ISOLATED_STAGING_REQUIRED',certified:false});
 try{
  const r=await fetch('https://pkgztteqtyebsggxnett.supabase.co/functions/v1/asmas-batch',{signal:AbortSignal.timeout(5000),redirect:'error'});
  const readiness=await r.json();
  if(readiness.project!=='ASMAS')throw Error('WRONG_BACKEND');
  return res.status(r.ok?200:503).json({project:'ASMAS',architecture:'SUPABASE_BATCH',redis_required:false,certified:false,backend:readiness});
 }catch{return res.status(503).json({project:'ASMAS',architecture:'SUPABASE_BATCH',status:'BACKEND_UNAVAILABLE',certified:false});}
}

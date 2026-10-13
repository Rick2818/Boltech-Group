export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 const e=process.env;
 const configured={gemini:!!e.GOOGLE_API_KEY,redis:!!(e.UPSTASH_REDIS_REST_URL&&e.UPSTASH_REDIS_REST_TOKEN||e.REDIS_URL),supabase_server:!!(e.ASMAS_DATABASE_URL||e.ASMAS_SUPABASE_SERVICE_ROLE_KEY)};
 const safe=e.ASMAS_ENV==='staging'&&e.ASMAS_GEMINI_MODEL==='gemini-2.5-flash'&&e.ASMAS_OUTBOUND_ENABLED==='false'&&e.ASMAS_PAYMENTS_ENABLED==='false';
 return res.status(503).json({project:'ASMAS',environment:e.ASMAS_ENV||'UNSET',model:e.ASMAS_GEMINI_MODEL||'UNSET',status:'NOT_READY',safe_staging:safe,credentials_configured:configured,providers_verified:false,durable_workers_deployed:false,certified:false,missing:Object.keys(configured).filter(k=>!configured[k]),next:'Configure isolated credentials, implement transactional repository, then run live five-agent E2E. No provider calls were made.'});
}

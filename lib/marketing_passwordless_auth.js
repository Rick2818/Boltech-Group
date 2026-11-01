import crypto from 'node:crypto';
import {getRedisClient} from './distributed_cache.js';
import {dispatchUniversalEmail} from './universal_email_engine.js';
const HASH = input => crypto.createHash('sha256').update(input).digest('hex');

const SESSION_KEY = 'boltech:marketing:auth:v1:';
const COOKIE_NAME = '__Host-boltech-marketing';
function ownerCookie(req){
  const m=String(req.headers?.cookie||'').match(/(?:^|;[ \t]*)__Host-boltech-marketing=([a-f0-9]{64})(?:;|$)/);
  return m?.[1]||'';
}
export async function requireMarketingSession(req,res,{redis=getRedisClient()}={}){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Vary','Cookie');
  if(!redis){res.status(503).json({error:'LOGIN_DATABASE_UNAVAILABLE'});return false;}
  const value=ownerCookie(req);
  if(!value){res.status(401).json({error:'LOGIN_REQUIRED'});return false;}
  try{
    const stored=await redis.get(SESSION_KEY+'session:'+HASH(value));
    const session=typeof stored==='string'?JSON.parse(stored):stored;
    if(session?.authorized===true){
      await redis.expire(SESSION_KEY+'session:'+HASH(value),SESSION_SECONDS);
      res.setHeader('Set-Cookie',sessionCookie(value));
      return true;
    }
  }catch{}
  res.status(401).json({error:'LOGIN_REQUIRED'});return false;
}

const CODE_SECONDS=600;
const SESSION_SECONDS=30*24*3600;
const dbkey=(type,id)=>SESSION_KEY+type+':'+id;
const decode=v=>typeof v==='string'?JSON.parse(v):v;
function secureOrigin(req){
 const host=String(req.headers?.host||'').toLowerCase();
 const origin=String(req.headers?.origin||'');
 return Boolean(host&&origin==='https://'+host);
}
function adminEmail(env){
 const email=String(env.BOLTECH_MARKETING_ADMIN_EMAIL||env.SMTP_USER||'').trim().toLowerCase();
 return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)?email:null;
}
function safeMatch(a,b){
 const left=Buffer.from(String(a||'')),right=Buffer.from(String(b||''));
 return left.length>0&&left.length===right.length&&crypto.timingSafeEqual(left,right);
}
const sessionCookie=value=>COOKIE_NAME+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+SESSION_SECONDS;
const endCookie=()=>COOKIE_NAME+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';
async function counted(redis,id,max,seconds){
 const k=dbkey('limit',id);
 const count=await redis.incr(k);
 if(count===1)await redis.expire(k,seconds);
 return count<=max;
}

async function deliverCode({to,code,send}){
 const result=await send({
  to,
  subject:'Boltech Group - Codigo de acceso privado',
  text:'Codigo de acceso a Mercadeo: '+code+'. Valido 10 minutos. Si no lo solicitaste, ignora este mensaje.',
  preferredTransport:'smtp'
 });
 return result?.acceptedByProvider===true;
}

export async function handleMarketingLogin(req,res,{env=process.env,redis=getRedisClient(),send=dispatchUniversalEmail,now=()=>Date.now(),random=crypto}={}){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('Vary','Cookie');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!redis)return res.status(503).json({error:'LOGIN_DATABASE_UNAVAILABLE'});
 if(req.method==='GET'){
  const token=ownerCookie(req);
  if(!token)return res.status(200).json({authenticated:false});
  try{
   const record=decode(await redis.get(dbkey('session',HASH(token))));
   return res.status(200).json({authenticated:record?.authorized===true});
  }catch{return res.status(503).json({error:'LOGIN_DATABASE_UNAVAILABLE'});}
 }
 if(!secureOrigin(req))return res.status(403).json({error:'ORIGIN_FORBIDDEN'});
 const action=String(req.body?.action||'');
 const ip=HASH(String(req.headers?.['x-vercel-forwarded-for']||req.headers?.['x-real-ip']||req.socket?.remoteAddress||'unknown').slice(0,180));
 try{
  if(action==='logout'){
   const existing=ownerCookie(req);
   if(existing)await redis.del(dbkey('session',HASH(existing)));
   res.setHeader('Set-Cookie',endCookie());
   return res.status(200).json({authenticated:false});
  }
  const recipient=adminEmail(env);
  if(!recipient)return res.status(503).json({error:'OWNER_EMAIL_NOT_CONFIGURED'});
  if(action==='request'){
   if(!await counted(redis,'global-request',12,3600)||!await counted(redis,'request-ip-'+ip,4,3600))
    return res.status(429).json({error:'LOGIN_RATE_LIMITED'});
   const challenge=random.randomBytes(16).toString('hex');
   const pin=String(random.randomInt(0,1000000)).padStart(6,'0');
   await redis.set(dbkey('challenge',challenge),JSON.stringify({hash:HASH(challenge+':'+pin),expires:now()+CODE_SECONDS*1000}),{ex:CODE_SECONDS});
   let delivered=false;
   try{delivered=await deliverCode({to:recipient,code:pin,send});}catch{}
   if(!delivered){
    await redis.del(dbkey('challenge',challenge));
    return res.status(503).json({error:'LOGIN_EMAIL_NOT_SENT'});
   }
   return res.status(200).json({sent:true,challenge,expiresIn:CODE_SECONDS});
  }

  if(action==='verify'){
   const challenge=String(req.body?.challenge||''),pin=String(req.body?.code||'');
   if(!/^[a-f0-9]{32}$/.test(challenge)||!/^[0-9]{6}$/.test(pin))
    return res.status(400).json({error:'INVALID_CODE'});
   if(!await counted(redis,'verify-ip-'+ip,30,3600))
    return res.status(429).json({error:'LOGIN_RATE_LIMITED'});
   const attempts=await redis.incr(dbkey('attempts',challenge));
   if(attempts===1)await redis.expire(dbkey('attempts',challenge),CODE_SECONDS);
   if(attempts>5){
    await redis.del(dbkey('challenge',challenge));
    return res.status(429).json({error:'LOGIN_ATTEMPTS_EXCEEDED'});
   }

   const record=decode(await redis.get(dbkey('challenge',challenge)));
   if(!record||record.expires<now()||!safeMatch(record.hash,HASH(challenge+':'+pin)))
    return res.status(401).json({error:'INVALID_OR_EXPIRED_CODE'});
   const consumed=await redis.getdel(dbkey('challenge',challenge));
   if(!consumed)return res.status(401).json({error:'CODE_ALREADY_USED'});

   const token=random.randomBytes(32).toString('hex');
   await redis.set(dbkey('session',HASH(token)),JSON.stringify({authorized:true,created:now()}),{ex:SESSION_SECONDS});
   res.setHeader('Set-Cookie',sessionCookie(token));
   return res.status(200).json({authenticated:true,expiresIn:SESSION_SECONDS});
  }
  return res.status(400).json({error:'INVALID_ACTION'});
 }catch{ return res.status(503).json({error:'LOGIN_UNAVAILABLE'}); }
}

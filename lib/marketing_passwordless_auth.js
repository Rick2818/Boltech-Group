import crypto from 'node:crypto';
import {getRedisClient} from './distributed_cache.js';
import {dispatchUniversalEmail} from './universal_email_engine.js';
const HASH = input => crypto.createHash('sha256').update(input).digest('hex');

const SESSION_KEY = 'boltech:marketing:auth:v1:';
const COOKIE_NAME = '__Host-boltech-marketing';
function ownerCookie(req){
  const m=String(req.headers?.cookie||'').match(/(?:^|;\\s*)__Host-boltech-marketing=([a-f0-9]{64})(?:;|$)/);
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
    if(session?.authorized===true)return true;
  }catch{}
  res.status(401).json({error:'LOGIN_REQUIRED'});return false;
}

const CODE_SECONDS=600;
const SESSION_SECONDS=7*24*3600;
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

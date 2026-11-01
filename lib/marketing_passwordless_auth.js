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

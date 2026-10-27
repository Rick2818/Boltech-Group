// Production Redis adapter for Leo's independently authenticated tenant runtime.
// Fail closed if Redis is not configured. No in-memory fallback or implicit TTL.
import {redisCommand} from './rsi_handoff_store.js';
const CAS_CREATE = "if redis.call('EXISTS',KEYS[1])==1 then return 'CONFLICT' end redis.call('SET',KEYS[1],ARGV[1]) return 'OK'";
const CAS_UPDATE = "local raw=redis.call('GET',KEYS[1]);if not raw then return 'MISSING' end;local ok,old=pcall(cjson.decode,raw);if not ok or type(old)~='table' then return 'CORRUPT' end;if old.version~=tonumber(ARGV[1]) then return 'CONFLICT' end;redis.call('SET',KEYS[1],ARGV[2]);return 'OK'";
const error=code=>{throw Object.assign(new Error(code),{code})};
export function createLeoRedisStore(command=redisCommand){
 return {
  async read(key){
   if(typeof key!=='string'||!/^leo:v1:[A-Za-z0-9_-]{3,100}:[A-Za-z0-9_-]{3,100}$/.test(key))error('LEO_STORE_KEY_INVALID');
   const raw=await command(['GET',key]);if(raw===null||raw===undefined)return null;
   try{const val=JSON.parse(raw);if(!val||typeof val!=='object'||Array.isArray(val)||!Number.isSafeInteger(val.version))throw Error();return val}
   catch{error('LEO_STORE_CORRUPT')}
  },
  async writeIfVersion(key,expected,next){
   if(typeof key!=='string'||!/^leo:v1:[A-Za-z0-9_-]{3,100}:[A-Za-z0-9_-]{3,100}$/.test(key))error('LEO_STORE_KEY_INVALID');
   if(!next||next.tenantId!==key.split(':')[2]||next.id!==key.split(':')[3])error('LEO_STORE_TENANT_MISMATCH');
   const out=expected===null?await command(['EVAL',CAS_CREATE,1,key,JSON.stringify(next)]):await command(['EVAL',CAS_UPDATE,1,key,String(expected),JSON.stringify(next)]);
   if(out==='OK')return true;
   if(out==='CONFLICT'||out==='MISSING')return false;
   error('LEO_STORE_UNAVAILABLE');
  }
 }
}

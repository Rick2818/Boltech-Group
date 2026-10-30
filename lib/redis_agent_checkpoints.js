// Durable resume checkpoints for a single tenant and order, backed by Redis.
// Never accept tenant identity without independent server-side authorization.
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,120}$/.test(x);
const ensure=(x,code)=>{if(!x)throw Error(code)};
export function createRedisAgentCheckpoints({command,ttlSeconds=604800}={}){
 ensure(typeof command==='function','CHECKPOINT_REDIS_REQUIRED');
 ensure(Number.isInteger(ttlSeconds)&&ttlSeconds>=3600,'CHECKPOINT_TTL_INVALID');
 const key=({orderId,customerId,tenantId})=>{
   ensure([orderId,customerId,tenantId].every(valid),'CHECKPOINT_KEY_INVALID');
   return 'boltech:agent:checkpoint:'+tenantId+':'+customerId+':'+orderId;
 };
 async function load(ids){
   const raw=await command(['GET',key(ids)]);
   if(!raw)return null;
   const x=JSON.parse(raw);
   ensure(x.orderId===ids.orderId&&x.tenantId===ids.tenantId&&x.customerId===ids.customerId,
      'CHECKPOINT_TENANT_MISMATCH');
   return x;
 }
 async function initialize(ids){
   const k=key(ids);const record={...ids,version:1,status:'AUTHORIZED',completedTasks:{},pendingTasks:{}};
   await command(['SET',k,JSON.stringify(record),'NX','EX',ttlSeconds]);
   return load(ids);
 }
 async function save({orderId,customerId,tenantId,expectedVersion,receipt}){
   const ids={orderId,customerId,tenantId},k=key(ids),old=await load(ids);
   ensure(old&&old.status==='AUTHORIZED'&&old.version===expectedVersion,
      'CHECKPOINT_STALE_OR_REVOKED');
   ensure(receipt?.status==='TASK_COMPLETED_NOT_DELIVERED' && typeof receipt.output==='string',
      'CHECKPOINT_RECEIPT_INVALID');
   const updated={...old,version:old.version+1,lastReceipt:receipt,updatedAt:new Date().toISOString()};
   // Atomic compare-and-set so two interrupted workers cannot overwrite each other.
   const lua='local raw=redis.call("GET",KEYS[1]); if not raw then return "MISSING" end; local v=cjson.decode(raw); if v.version~=tonumber(ARGV[1]) or v.status~="AUTHORIZED" then return "CONFLICT" end; redis.call("SET",KEYS[1],ARGV[2],"EX",ARGV[3]); return "OK"';
   const outcome=await command(['EVAL',lua,'1',k,String(expectedVersion),JSON.stringify(updated),String(ttlSeconds)]);
   ensure(outcome==='OK','CHECKPOINT_CONCURRENT_UPDATE');
   return updated;
 }
 async function revoke(ids){
   const k=key(ids),old=await load(ids);
   if(!old)return null;
   const updated={...old,status:'REVOKED',version:old.version+1};
   const lua='local raw=redis.call("GET",KEYS[1]); if not raw then return "MISSING" end; local v=cjson.decode(raw); if v.version~=tonumber(ARGV[1]) then return "CONFLICT" end; redis.call("SET",KEYS[1],ARGV[2],"EX",ARGV[3]); return "OK"';
   ensure(await command(['EVAL',lua,'1',k,String(old.version),JSON.stringify(updated),String(ttlSeconds)])==='OK','CHECKPOINT_REVOKE_CONFLICT');
   return updated;
 }
 return {initialize,load,save,revoke};
}

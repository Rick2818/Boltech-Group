// Redis adapter for the isolated Agent 1 V2. Reuse the existing command transport;
// no new Redis instance, credentials, or scheduled job.
const prefix='boltech:agent1:v2:';
const reservationLua=`
local global=KEYS[1]
local record=KEYS[2]
local counter=KEYS[3]
local day=ARGV[1]
local recipient=ARGV[2]
local cap=tonumber(ARGV[3])
if redis.call('EXISTS',global)==1 then return 'CROSS_DAY_HISTORY_RECONCILIATION_REQUIRED' end
if redis.call('EXISTS',record)==1 then return 'ALREADY_RESERVED' end
if cap and tonumber(redis.call('GET',counter) or '0')>=cap then return 'DAILY_CAP_REACHED' end
redis.call('SET',global,cjson.encode({state='SEEN',day=day}))
redis.call('SET',record,cjson.encode({state='RESERVED',day=day,recipient=recipient}))
redis.call('INCR',counter)
return 'RESERVED'
`;
const updateLua=`
local current=redis.call('GET',KEYS[1])
if not current then return 0 end
local obj=cjson.decode(current)
if obj.state~=ARGV[1] then return 0 end
local patch=cjson.decode(ARGV[2])
for k,v in pairs(patch) do obj[k]=v end
redis.call('SET',KEYS[1],cjson.encode(obj))
return 1
`;
export function createAgent1RedisLedger(command){
 if(typeof command!=='function')throw Error('REDIS_COMMAND_TRANSPORT_REQUIRED');
 const k=x=>prefix+x;
 return {
  async read(key){const v=await command(['GET',k(key)]);return v?JSON.parse(v):null;},
  async insertIfAbsent(key,row){return await command(['SET',k(key),JSON.stringify(row),'NX'])==='OK';},
  async updateIfState(key,state,patch){return Number(await command(['EVAL',updateLua,1,k(key),state,JSON.stringify(patch)]))===1;},
  async reserveProspectAtomically({key,globalKey,day,recipient,cap}){
   const outcome=await command(['EVAL',reservationLua,3,k(globalKey),k(key),k('daily:'+day+':count'),day,recipient,cap===null?'':String(cap)]);
   return outcome==='RESERVED'?{reserved:true}:{reserved:false,state:'BLOCKED',reason:String(outcome||'RESERVATION_FAILED')};
  }
 };
}

// Redis Streams adapter for a dedicated ASMAS Redis instance.
// Requires a real Redis client supporting XREADGROUP, XACK, XADD, XGROUP, XAUTOCLAIM.
// No client or credentials are imported from Boltech production.
export class RedisStreamsBroker {
 constructor(redis,{group='asmas-workers',prefix='asmas:agent_',blockMs=1000}={}){
  if(!redis)throw Error('ASMAS_REDIS_REQUIRED');
  this.redis=redis;this.group=group;this.prefix=prefix;this.blockMs=blockMs;
 }
 stream(agent){if(!/^A[1-5]$/.test(agent))throw Error('INVALID_AGENT');return this.prefix+agent.slice(1)+'_queue';}
 async ensureGroup(agent){
  const stream=this.stream(agent);
  try{await this.redis.xgroup('CREATE',stream,this.group,'0','MKSTREAM');}
  catch(e){if(!String(e.message||e).includes('BUSYGROUP'))throw e;}
 }
 async publish(agent,envelope){if(envelope.destination_agent!==agent)throw Error('DESTINATION_MISMATCH');return this.redis.xadd(this.stream(agent),'*','envelope',JSON.stringify(envelope));}
 async read(agent,consumer){
  await this.ensureGroup(agent);
  const raw=await this.redis.xreadgroup('GROUP',this.group,consumer,'COUNT',1,'BLOCK',this.blockMs,'STREAMS',this.stream(agent),'>');
  if(!raw?.length)return null;
  const [,entries]=raw[0];if(!entries?.length)return null;
  const [id,fields]=entries[0];const ix=fields.indexOf('envelope');
  if(ix<0)throw Error('MISSING_ENVELOPE');
  return {id,agent,message:JSON.parse(fields[ix+1])};
 }
 async ack(agent,id){return this.redis.xack(this.stream(agent),this.group,id);}
 async reclaim(agent,consumer,{idleMs=60000,count=10}={}){
  await this.ensureGroup(agent);
  return this.redis.xautoclaim(this.stream(agent),this.group,consumer,idleMs,'0-0','COUNT',count);
 }
}

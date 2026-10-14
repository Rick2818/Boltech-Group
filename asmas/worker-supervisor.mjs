// Finite worker polling host; five distinct consumers, explicit stop controller.
// Requires durable claim+commit implementation; no production activity by default.
import {consumeOne} from './queue-worker.mjs';
import {RedisStreamsBroker} from './redis-streams.mjs';
export async function pollAgent({agent,redis,repository,executor,consumer}){
 if(!/^A[1-5]$/.test(agent))throw Error('INVALID_AGENT');
 const transport=new RedisStreamsBroker(redis);
 const adapter={
  read:async()=>transport.read(agent,consumer||'asmas-'+agent),
  ack:async(id)=>transport.ack(agent,id)
 };
 return consumeOne({broker:adapter,repository,executor,consumer:consumer||'asmas-'+agent});
}
export const WORKERS=Object.freeze(['A1','A2','A3','A4','A5']);

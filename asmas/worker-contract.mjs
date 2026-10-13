// Finite state machine shared by future durable worker adapters.
export const TASK_STATES=Object.freeze(['QUEUED','LEASED','EXECUTING','SUCCEEDED','RETRY_WAIT','FAILED','UNKNOWN_RESULT']);
const allowed={QUEUED:['LEASED'],LEASED:['EXECUTING','RETRY_WAIT'],EXECUTING:['SUCCEEDED','RETRY_WAIT','FAILED','UNKNOWN_RESULT'],RETRY_WAIT:['LEASED','FAILED'],UNKNOWN_RESULT:['SUCCEEDED','FAILED'],SUCCEEDED:[],FAILED:[]};
export function taskTransition(task,to,{expectedVersion,now=Date.now()}={}){
 if(!task||!Number.isInteger(task.version)||expectedVersion!==task.version)throw Error('OPTIMISTIC_LOCK_CONFLICT');
 if(!allowed[task.status]?.includes(to))throw Error('INVALID_TASK_TRANSITION');
 if(to==='LEASED'&&task.lease_until&&task.lease_until>now)throw Error('LEASE_ACTIVE');
 return {...task,status:to,version:task.version+1,updated_at:new Date(now).toISOString()};
}
export function processEnvelope(envelope,{seen=new Set(),execute}={}){
 if(!envelope?.idempotency_key)throw Error('IDEMPOTENCY_REQUIRED');
 if(seen.has(envelope.idempotency_key))return {status:'DUPLICATE',ack:true};
 if(typeof execute!=='function')throw Error('EXECUTOR_REQUIRED');
 const result=execute(envelope);
 if(result?.status==='UNKNOWN_RESULT')return {status:'UNKNOWN_RESULT',ack:false,reconcile:true};
 if(result?.status!=='SUCCEEDED')return {status:'FAILED',ack:false};
 seen.add(envelope.idempotency_key);
 return {status:'SUCCEEDED',ack:true};
}

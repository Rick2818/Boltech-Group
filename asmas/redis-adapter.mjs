// Adapter contract only: worker runtime credentials must be provided in isolated environment.
export const STREAMS=Object.freeze(Object.fromEntries([1,2,3,4,5].map(n=>['A'+n,'asmas:agent_'+n+'_queue'])));
export function safeRetry({kind,attempts=0,uncertain=false}){
 if(uncertain||['AUTH_ERROR','VALIDATION_ERROR','PAYMENT_UNKNOWN','SEND_UNKNOWN'].includes(kind))return false;
 return attempts<3;
}
export function validateEnvelope(e){
 const keys=['schema_version','message_id','source_agent','destination_agent','task_id','idempotency_key'];
 if(keys.some(k=>!e?.[k]))throw Error('INVALID_ENVELOPE');
 if(!STREAMS[e.destination_agent])throw Error('UNKNOWN_DESTINATION');
 return STREAMS[e.destination_agent];
}

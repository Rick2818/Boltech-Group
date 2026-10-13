// ASMAS durable-worker adapter: all I/O is dependency-injected.
// Production requires a real transactional repository and message broker.
// NEVER acknowledge a task before its results and outgoing events are committed.
import {validateEnvelope} from './redis-adapter.mjs';
export async function consumeOne({broker,repository,executor,consumer='asmas-worker'}){
 if(!broker?.read||!broker?.ack||!repository?.claim||!repository?.commit||!executor)throw Error('DEPENDENCIES_REQUIRED');
 const entry=await broker.read(consumer);
 if(!entry)return {status:'IDLE'};
 const topic=validateEnvelope(entry.message);
 const task=await repository.claim(entry.message.idempotency_key,consumer);
 if(task.status==='COMPLETED'){await broker.ack(entry.id);return {status:'DUPLICATE_ACKED'};}
 if(task.status!=='CLAIMED')return {status:'DEFERRED',reason:task.status};
 try{
   const output=await executor(entry.message,{task});
   if(output?.status==='UNKNOWN_RESULT'){
      await repository.flagUnknown(task.id,output);
      return {status:'RECONCILIATION_REQUIRED',ack:false};
   }
   if(output?.status!=='SUCCEEDED')throw Error(output?.error||'EXECUTION_FAILED');
   // Commit state + events atomically in repository, then ack transport.
   await repository.commit(task.id,{output,events:output.events||[],topic});
   await broker.ack(entry.id);
   return {status:'COMPLETED',ack:true};
 }catch(error){
   await repository.fail(task.id,{message:String(error.message),retryable:true});
   return {status:'FAILED',ack:false};
 }
}
export async function publishOutbox({repository,broker,limit=25}){
 if(!repository?.pendingOutbox||!repository?.markPublished||!broker?.publish)throw Error('DEPENDENCIES_REQUIRED');
 let sent=0;
 for(const event of await repository.pendingOutbox(limit)){
   await broker.publish(event.topic,event.payload,event.id);
   await repository.markPublished(event.id);
   sent++;
 }
 return sent;
}

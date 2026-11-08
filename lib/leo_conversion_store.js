// Cookie-scoped web conversation memory. Separate from authenticated tenant objectives.
// No outbound queue, cron, CRM import or payment mutations are installed here.
import {createHash,randomBytes} from 'node:crypto';
import {redisCommand} from './rsi_handoff_store.js';
const COOKIE='boltech_leo_conversion';
const TTL=30*86400;
const commitScript="if redis.call('GET',KEYS[2])~=ARGV[1] then return 'CONFLICT' end redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]);redis.call('DEL',KEYS[2]);return 'OK'";
const releaseScript="if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0";
const err=code=>{throw Object.assign(Error(code),{statusCode:code==='LEO_CONVERSATION_BUSY'?409:503})};
export function createLeoConversionStore({command=redisCommand,env=process.env}={}) {
 return {
  configured:()=>Boolean(env.UPSTASH_REDIS_REST_URL&&env.UPSTASH_REDIS_REST_TOKEN),
  async open(req,res){
   const raw=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
   const id=/^[a-f0-9]{64}$/.test(raw||'')?raw:randomBytes(32).toString('hex');
   const key='leo:conversion:v1:'+createHash('sha256').update(id).digest('hex');
   const lock=key+':lock',owner=randomBytes(16).toString('hex');
   if(await command(['SET',lock,owner,'NX','EX',60])!=='OK')err('LEO_CONVERSATION_BUSY');
   let state=null;
   try {
    const value=await command(['GET',key]);
    if(value){
     if(typeof value!=='string'||value.length>65536)err('LEO_CONVERSATION_CORRUPT');
     state=JSON.parse(value);
     if(state?.schema!==1||!Array.isArray(state.history)||state.history.length>16||!Array.isArray(state.events)||state.events.length>40)err('LEO_CONVERSATION_CORRUPT');
    }
   }catch(error){await command(['EVAL',releaseScript,1,lock,owner]).catch(()=>{});throw error;}
   const existing=res.getHeader?.('Set-Cookie');
   const cookie=COOKIE+'='+id+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+TTL;
   res.setHeader('Set-Cookie',existing?[...(Array.isArray(existing)?existing:[existing]),cookie]:cookie);
   return {
    state,
    async commit(next){
     if(await command(['EVAL',commitScript,2,key,lock,owner,JSON.stringify(next),TTL])!=='OK')err('LEO_CONVERSATION_CONFLICT');
    },
    async release(){await command(['EVAL',releaseScript,1,lock,owner]);}
   };
  }
 };
}
export function conversionSnapshot({previous,response,message,history,now=new Date().toISOString()}) {
 const revision=(previous?.revision||0)+1;
 const newEvents=response.conversion.events.map(type=>({id:revision+':'+type,type,at:now,stage:response.conversion.stage}));
 return {schema:1,revision,updatedAt:now,guideVersion:response.conversion.guideVersion,
  facts:response.conversion.facts,stage:response.conversion.stage,nextAction:response.conversion.nextAction,pilotDraft:response.conversion.pilotDraft,
  history:[...history,{role:'user',text:message},{role:'assistant',text:response.reply}].slice(-16),
  events:[...(previous?.events||[]),...newEvents].slice(-40)};
}

import crypto from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const campaignDay=now=>new Date(new Date(now).getTime()-6*3600000).toISOString().slice(0,10);
const count=n=>Number.isInteger(n)&&n>=0?n:0;
// Both existing schedulers enter this one durable daily ledger. Uncertain work
// is held for reconciliation, never restarted because a lease timed out.
export function createDailyCampaign({command,execute,campaign,now=()=>new Date().toISOString()}) {
 const key=()=>`boltech:rsi01:daily:${campaignDay(now())}`;
 async function status(){const raw=await command(['GET',key()]);return raw?JSON.parse(raw):{day:campaignDay(now()),state:'NOT_STARTED'};}
 async function run(){
  const day=campaignDay(now()),ledger=`boltech:rsi01:daily:${day}`,lock=ledger+':lock',lease=crypto.randomUUID();
  if(await command(['SET',lock,lease,'NX','PX',300000])!=='OK')fail('RSI01_DAILY_BUSY');
  const save=async row=>{
   const result=await command(['EVAL',"if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 'LEASE_LOST' end redis.call('SET',KEYS[2],ARGV[2]); return 'OK'",2,lock,ledger,lease,JSON.stringify(row)]);
   if(result!=='OK')fail('RSI01_DAILY_OWNERSHIP_LOST');
   return row;
  };
  try{
   const raw=await command(['GET',ledger]);
   const existing=raw?JSON.parse(raw):{state:'NOT_STARTED'};
   if(existing.state==='FINISHED'&&!(existing.status==='ATTENTION'&&existing.campaign?.attempted===0&&existing.campaign?.sent===0&&existing.campaign?.uncertain===0&&existing.campaign?.blocked===0))return {...existing,reused:true};
   if(existing.state==='FINISHED')existing.state='NOT_STARTED';
   if(existing.state!=='NOT_STARTED')fail('RSI01_DAILY_RECONCILIATION_REQUIRED');
   const row={schemaVersion:1,day,state:'RUNNING',startedAt:now(),status:'UNCONFIRMED'};
   await save(row);
   try{
    const result=await execute({rsi:'RSI-01',cycleId:'daily-'+day+(raw?'-resume-'+crypto.randomUUID().slice(0,8):'')});
    row.agentOutcome=['COMPLETED','BLOCKED'].includes(result?.receipt?.outcome)?result.receipt.outcome:'UNCONFIRMED';
    row.agentRunId=typeof result?.receipt?.runId==='string'?result.receipt.runId.slice(0,120):null;
    // Individually authorized sender retains its own evidence and deduplication.
    // Its queue is independent from research-only blockers in the agent receipt.
    const out=await campaign();
    const results=Array.isArray(out?.results)?out.results:[];
    row.campaign={reviewed:count(out?.reviewed),approvedTotal:count(out?.approvedTotal),eligible:count(out?.eligible),
     attempted:results.filter(r=>r.attempted===true).length,sent:results.filter(r=>r.status==='SENT').length,
     uncertain:results.filter(r=>['UNKNOWN','SEND_PENDING'].includes(r.status)).length,
     blocked:results.filter(r=>['BLOCKED','FAILED'].includes(r.status)).length,
     status:['EXECUTED','ATTENTION','NO_APPROVED_LEADS'].includes(out?.cycleStatus)?out.cycleStatus:'UNCONFIRMED'};
    row.status=row.agentOutcome==='UNCONFIRMED'||row.campaign.status==='UNCONFIRMED'?'FAILED':
     row.agentOutcome==='BLOCKED'||row.campaign.status!=='EXECUTED'?'ATTENTION':'EXECUTED';
   }catch{
    // Any uncertain side effect is held, including a server crash after dispatch.
    await save({...row,state:'UNKNOWN',status:'FAILED',code:'RSI01_DAILY_RECONCILIATION_REQUIRED',finishedAt:now()});
    fail('RSI01_DAILY_RECONCILIATION_REQUIRED');
   }
   return await save({...row,state:'FINISHED',finishedAt:now(),reused:false});
  }finally{
   await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,lock,lease]);
  }
 }
 return {run,status};
}

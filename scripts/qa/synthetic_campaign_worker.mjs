import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRsiExecutor} from '../../lib/rsi_agent_executor.js';
import {createDailyCampaign} from '../../lib/rsi01_daily_campaign.js';
import {createHandoffStore,CAS_SCRIPT} from '../../lib/rsi_handoff_store.js';
const caseId=process.argv[2];
assert.match(caseId||'',/^QA-[A-Za-z0-9-]{1,70}$/);
const recipient='cliente@boltech.invalid',root=new URL(`../../ops-output/synthetic-qa/${caseId}/`,import.meta.url);
await mkdir(root,{recursive:true});
// Terminal case receipt takes precedence over date-scoped campaign ledgers.
try{const previous=JSON.parse(await readFile(new URL('report.json',root),'utf8'));if(previous.status==='ISOLATED_QA_PASS'&&previous.caseId===caseId){console.log(JSON.stringify({...previous,reused:true}));process.exit(0);}}catch(e){if(e.code!=='ENOENT')throw e;}
const lock=new URL('process.lock',root);const handle=await open(lock,'wx');
const path=new URL('state.json',root);
try {
let db;try {db=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const WORK='tblHVqUMifOFjlGvj';
db??={scope:'ISOLATED_SYNTHETIC_QA',caseId,kv:{},outbox:[],receipts:[],tables:{[WORK]:['RSI-01','RSI-02','RSI-03','MARKETING'].map((RSI,i)=>({id:'recQa'+i,fields:{RSI,'Work ID':'BOOTSTRAP:'+RSI,Status:'QA_ONLY',Evidence:'Cliente Sintético',Authorization:'QA only'}}))}};
assert.equal(db.scope,'ISOLATED_SYNTHETIC_QA');assert.equal(db.caseId,caseId);
const save=async()=>{await writeFile(new URL('state.tmp',root),JSON.stringify(db,null,2));await rename(new URL('state.tmp',root),path);};
const receipt=async(stage,result)=>{if(!db.receipts.some(r=>r.stage===stage)){const row={caseId,stage,scope:db.scope,at:new Date().toISOString(),previous:db.receipts.at(-1)?.digest??null,result};db.receipts.push({...row,digest:createHash('sha256').update(JSON.stringify(row)).digest('hex')});await save();}};
const command=async a=>{
 const [op,k,v]=a;
 if(op==='GET')return db.kv[k]??null;
 if(op==='SET'){if(a.includes('NX')&&db.kv[k]!==undefined)return null;db.kv[k]=v;await save();return 'OK';}
 if(op==='EVAL'){
  if(k===CAS_SCRIPT){const row=JSON.parse(db.kv[a[3]]);if(row.version!==Number(a[4]))return 'CONFLICT';db.kv[a[3]]=a[5];}
  else if(a[2]===2){if(db.kv[a[3]]!==a[5])return 'LEASE_LOST';db.kv[a[4]]=a[6];}
  else {if(db.kv[a[3]]===a[4])delete db.kv[a[3]];}
  await save();return 'OK';
 }
 throw Error('QA_UNSUPPORTED_STORE_OPERATION');
};
const request=async(table,opts={})=>{
 if(opts.method==='PATCH'){assert.equal(table,WORK);for(const r of opts.body.records){const row=db.tables[WORK].find(w=>w.id===r.id);assert.ok(row);Object.assign(row.fields,r.fields);}await save();return {records:structuredClone(opts.body.records.map(r=>db.tables[WORK].find(w=>w.id===r.id)))};}
 else assert.ok(!opts.method||opts.method==='GET','QA_UNSUPPORTED_TABLE_WRITE');
 return {records:structuredClone(db.tables[table]||[])};
};
const execute=createRsiExecutor({command,request,followups:async()=>({enabled:false,results:[]}),relay:async()=>({results:[]}),marketingCycle:async()=>({reviewed:0,results:[]}),costs:async()=>({complete:false}),sales:async()=>({paidOrders:0,cashCollectedUsd:0}),partners:async()=>[],referrals:async()=>[],closing:async()=>({state:'QA_NO_CLOSING'})}).run;
const send=async to=>{assert.equal(to,recipient,'QA_RECIPIENT_DENIED');if(!db.outbox.length){db.outbox.push({id:caseId+'-mail',to,from:'agente1@boltech.invalid',subject:'CLIENTE SINTÉTICO',transport:'LOCAL_SIMULATED',providerMessageId:null});await save();}return db.outbox[0];};
await assert.rejects(send('external@example.com'),/QA_RECIPIENT_DENIED/);
await assert.rejects(fetch('https://boltech-group.vercel.app'),/QA_NETWORK_DENIED/);
const at=process.argv.find(x=>x.startsWith('--at='))?.slice(5);if(at)assert.ok(Number.isFinite(Date.parse(at)));
const daily=createDailyCampaign({command,execute,...(at?{now:()=>at}:{}),campaign:async()=>{await send(recipient);if(process.argv.includes('--fault-after-send'))throw Error('QA_INJECTED_AFTER_PERSIST');return {reviewed:1,approvedTotal:1,eligible:1,cycleStatus:'EXECUTED',results:[{status:'SENT',attempted:true,transport:'LOCAL_SIMULATED'}]};}});
let campaign;
try {campaign=await daily.run();}catch(e){await receipt('FAILURE',{code:e.code,ledger:await daily.status(),virtualMessages:db.outbox.length});throw e;}
const original=Object.values(db.kv).map(v=>{try{return JSON.parse(v)}catch{return null}}).find(v=>v?.receipt?.rsi==='RSI-01');
assert.ok(original?.receipt);await receipt('AGENT_1',original.receipt);
await receipt('QA_MAIL',{message:db.outbox[0],campaign});
const handoffs=createHandoffStore(command);const id=caseId+'-A1-A2';
let {record}=await handoffs.create({handoffId:id,opportunityId:caseId,from:'RSI-01',to:'RSI-02',owner:'RSI-02',reason:'Cliente Sintético: QA harness handoff; not a buyer reply',evidenceRef:db.outbox[0].id});
for(const state of ['ACCEPTED','COMPLETED']){if(record.state===state||record.state==='COMPLETED')continue;record=await handoffs.transition({handoffId:id,expectedVersion:record.version,state,owner:'RSI-02',evidenceRef:db.outbox[0].id});}
await receipt('QA_HANDOFF',record);
assert.equal(db.outbox.length,1);assert.equal(record.state,'COMPLETED');
await receipt('SUMMARY',{status:'ISOLATED_QA_PASS',virtualMessages:1,realEmails:0,productionWrites:0,payments:0,transport:'LOCAL_SIMULATED',agent2AutonomyCertified:false,gmailVercelCertified:false});
const report={...db.receipts.at(-1).result,caseId,reused:campaign.reused,agentBlockers:original.receipt.blockers,receipts:db.receipts};
await writeFile(new URL('report.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await handle.close();await unlink(lock);}

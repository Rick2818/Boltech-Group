// Operator-driven isolated QA: existing executors, durable local adapters, Gmail
// receipts supplied by the authenticated connector. No production credentials.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createGoogleAdkTeam} from '../../lib/google_adk_agents.js';
import {createRsiExecutor} from '../../lib/rsi_agent_executor.js';
import {createCommercialRelay} from '../../lib/commercial_relay.js';
import {createInteragentCoordinator} from '../../lib/interagent_coordinator.js';
import {createRsiMarketingCycle} from '../../lib/rsi_marketing_cycle.js';
import {createRsi01Followups} from '../../lib/rsi01_followups.js';
import {createRsi03Closing} from '../../lib/rsi03_closing.js';

const root='ops-output/isolated-gmail-QA-20261015-2125';
const WORK='tblHVqUMifOFjlGvj',LEADS='tblZaox2MX5uYA5PZ';
const sender='ricardo.boltechgroup@gmail.com';
const roles=['RSI-01','MARKETING','RSI-02','RSI-03'];
const role=process.argv[2];
assert.ok([...roles,'DIRECTORA','FINAL'].includes(role),'QA_ROLE_INVALID');
await mkdir(root,{recursive:true});
const input=JSON.parse(await readFile(`${root}/input.json`,'utf8'));
assert.equal(input.kind,'CLIENTE_SINTETICO');
assert.equal(input.gmail.from,sender);assert.equal(input.gmail.to,sender);
assert.ok(input.gmail.labels.includes('SENT')&&input.gmail.labels.includes('INBOX'));
assert.ok(input.gmail.text.includes('CLIENTE SINTÉTICO'));
assert.match(input.gmail.messageId,/^[a-f0-9]+$/);
const dbPath=`${root}/state.json`;
let db;
try{db=JSON.parse(await readFile(dbPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!db){
  assert.equal(role,'RSI-01');
  db={kind:'ISOLATED_QA_ONLY',caseId:'QA-20261015-2125',kv:{},sets:{},events:[],receipts:[],mail:[],tables:{
    [WORK]:roles.map((rsi,i)=>({id:`recQaBootstrap${i}`,fields:{'Work ID':`BOOTSTRAP:${rsi}`,RSI:rsi,Status:'QA_ONLY',Evidence:JSON.stringify({kind:'CLIENTE_SINTETICO',messageId:input.gmail.messageId,statement:input.gmail.text}),Authorization:'Ricardo: isolated synthetic trial; no production campaigns or payments'}})),
    [LEADS]:[{id:'rec00000000000QA',fields:{Name:'Cliente Sintético','Data Quality':'QA','Contact Email':sender,'Experiment Cohort':'RSI-01',Notes:'Never include in commercial pipeline'}}],
    partners:[],referrals:[],costs:[],payments:[]}};
}
assert.equal(db.kind,'ISOLATED_QA_ONLY');
async function save(){await writeFile(dbPath+'.tmp',JSON.stringify(db,null,2));await rename(dbPath+'.tmp',dbPath);}
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
globalThis.fetch=async()=>{throw Error('QA_NETWORK_BOUNDARY_DENIED');};
for(const key of Object.keys(process.env))if(/TOKEN|SECRET|API_KEY|AIRTABLE|UPSTASH|REDIS|WOMPI/.test(key))delete process.env[key];
const previous=db.receipts.at(-1);
if(previous){
  assert.equal(input.previousReceiptDigest,previous.digest,'QA_CHAIN_DIGEST_MISMATCH');
  assert.equal(input.gmail.roleReceiptDigest,previous.digest,'QA_MAIL_RECEIPT_MISMATCH');
  assert.ok(input.gmail.text.includes(previous.digest),'QA_EMAIL_MISSING_DIGEST');
  assert.ok(!db.mail.some(m=>m.messageId===input.gmail.messageId),'QA_EMAIL_REPLAY');
}
db.mail.push({...input.gmail,readAt:new Date().toISOString()});await save();
async function command(args){
  const [op,k,v]=args;let out;
  if(op==='GET')return db.kv[k]??null;
  if(op==='SET'){if(args.includes('NX')&&db.kv[k]!==undefined)return null;db.kv[k]=v;out='OK';}
  else if(op==='SMEMBERS')return db.sets[k]||[];
  else if(op==='SADD'){db.sets[k]=[...new Set([...(db.sets[k]||[]),v])];out=1;}
  else if(op==='EVAL'){
    const count=args[2],keys=args.slice(3,3+count),values=args.slice(3+count);
    if(count===2){if(db.kv[keys[0]]!==values[0])return 'LEASE_LOST';db.kv[keys[1]]=values[1];out='OK';}
    else if(count===1&&k.includes('DEL')){if(db.kv[keys[0]]===values[0])delete db.kv[keys[0]];out=1;}
    else if(count===1&&k.includes("raw~=ARGV[1]")){if(db.kv[keys[0]]!==values[0])return 'CONFLICT';db.kv[keys[0]]=values[1];out='OK';}
    else throw Error('QA_UNSUPPORTED_ATOMIC_OPERATION');
  }else throw Error('QA_UNSUPPORTED_STORE_OPERATION');
  db.events.push({at:new Date().toISOString(),operation:op});await save();return out;
}
async function request(table,opts={}){
  assert.ok([WORK,LEADS].includes(table),'QA_TABLE_BOUNDARY_DENIED');
  if(opts.method==='PATCH'){
    assert.equal(table,WORK);
    const changed=[];for(const change of opts.body.records){const row=db.tables[table].find(r=>r.id===change.id);assert.ok(row);Object.assign(row.fields,change.fields);changed.push(row);}
    await save();return {records:structuredClone(changed)};
  }
  assert.ok(!opts.method||opts.method==='GET');return {records:structuredClone(db.tables[table])};
}
const lead=async id=>structuredClone(db.tables[LEADS].find(x=>x.id===id));
const gmail={
  verify:async()=>({verified:true,sender,basis:'Authenticated connector profile and Gmail readback'}),
  message:async id=>{const m=db.mail.find(x=>x.messageId===id);assert.ok(m,'QA_GMAIL_RECEIPT_NOT_IMPORTED');return {id:m.messageId,from:m.from,to:m.to,text:m.text,sent:true,threadId:m.threadId,rfcMessageId:m.rfcMessageId,receivedAt:m.sentAt};},
  search:async()=>{throw Error('QA_LIVE_HISTORY_NOT_AVAILABLE_IN_LOCAL_EXECUTOR');},
  thread:async()=>{throw Error('QA_LIVE_THREAD_NOT_AVAILABLE_IN_LOCAL_EXECUTOR');},
  send:async()=>{throw Error('QA_SEND_REQUIRES_AUTHENTICATED_CONNECTOR');}
};
const coordinator=createInteragentCoordinator({command,lead,gmail,acceptance:gmail.message,order:async id=>db.tables.payments.find(x=>x.orderId===id),verifyPayment:async()=>false});
// This QA environment has no outbound follow-up authorization. The production
// plan and production records cannot enter its local adapters.
const qaMarketing=Object.assign({},coordinator,{prepareFollowupSupport:async()=>({enabled:false,scope:'ISOLATED_QA_NO_PROSPECTS',results:[]})});
const followups=createRsi01Followups({command,gmail,record:lead,plan:{enabled:false,accounts:[],maxPerCycle:0}});
const closer=createRsi03Closing({command,gmail,lead,coordinator,env:{},order:async id=>db.tables.payments.find(x=>x.orderId===id),gateway:async()=>{throw Error('QA_PAYMENT_BOUNDARY_DENIED');},checkout:async()=>{throw Error('QA_PAYMENT_BOUNDARY_DENIED');},verifyPayment:async()=>false});
const relay=createCommercialRelay({request,command,gmail,env:{},registerClosing:closer.register});
let result;
if(roles.includes(role)){
  assert.equal(role,roles[db.receipts.filter(r=>roles.includes(r.role)).length],'QA_ROLE_ORDER_INVALID');
  if(role==='RSI-02'){
    const before=db.mail[0].sentAt,after=input.gmail.sentAt;
    assert.ok(Date.parse(after)>=Date.parse(before));
    db.tables[WORK].push({id:'recQaAuditAccepted',fields:{RSI:'RSI-02',Status:'AUDIT_ACCEPTED',Evidence:'Cliente Sintético: actual internal Gmail timestamps, not customer ROI',Authorization:JSON.stringify({accepted:true,kind:'RESPONSE_LOG_ANALYSIS',evidenceRef:input.gmail.messageId,samples:[{receivedAt:before,usefulResponseAt:after}]})}});await save();
  }
  const executor=createRsiExecutor({command,request,
    costs:async()=>({complete:false,totalCostUsd:null,basis:'No commercial cost evidence in isolated QA'}),
    sales:async()=>({paidOrders:db.tables.payments.length,cashCollectedUsd:0,scope:'ISOLATED_QA_ONLY'}),
    partners:async()=>db.tables.partners,referrals:async()=>db.tables.referrals,
    followups:followups.run,relay:relay.run,closing:closer.runNext,marketingCycle:createRsiMarketingCycle(qaMarketing)});
  const team=createGoogleAdkTeam({execute:executor.run});
  const a=await team.run({rsi:role,cycleId:db.caseId});
  assert.equal(a.orchestration.modelCalls,0);assert.equal(a.receipt.outcome,'COMPLETED');
  assert.ok(a.receipt.tools.length>0);assert.equal(a.reused,false);
  // Reconstruct the actual executors and read the persisted receipt; do not rerun
  // the work or email after a process restart.
  const replay=await createGoogleAdkTeam({execute:createRsiExecutor({command,request}).run}).run({rsi:role,cycleId:db.caseId});
  assert.equal(replay.reused,true);assert.deepEqual(replay.receipt,a.receipt);
  result={execution:a,restartReadbackVerified:true};
}else if(role==='DIRECTORA'){
  assert.deepEqual(db.receipts.map(x=>x.role),roles);
  const receipts=db.receipts.map(x=>JSON.parse(db.tables[WORK].find(r=>r.fields.RSI===x.role&&r.fields['Work ID'].startsWith('BOOTSTRAP:')).fields['Execution Receipt']));
  assert.ok(receipts.every(x=>x.outcome==='COMPLETED'));
  const queue=await coordinator.queue('DIRECTORA');assert.equal(queue.pending.length,0);
  let excluded=false;try{await coordinator.submit({eventId:db.caseId+'-no-fake-close',opportunityId:db.tables[LEADS][0].id,from:'RSI-03',type:'CLOSE_REPORTED',orderId:'qa-no-payment',acceptanceRef:input.gmail.messageId});}catch(e){excluded=e.code==='INTERAGENT_OPPORTUNITY_EXCLUDED';}
  assert.equal(excluded,true,'QA_FALSE_SALE_NOT_BLOCKED');
  result={rolesReviewed:roles,receiptsReviewed:receipts.length,queue,syntheticClosureRejected:true,paymentCount:0,commercialResult:'HOLD_SYNTHETIC_NOT_A_SALE'};
}else{
  assert.equal(previous.role,'DIRECTORA');
  assert.equal(db.tables.payments.length,0);
  result={status:'ISOLATED_TECHNICAL_CHAIN_PASS',roles:db.receipts.map(x=>x.role),gmailMessagesRead:db.mail.length,productionAgentCycle:false,commercialHandoffCompleted:false,sale:false,payment:false,limits:'Real existing executor code and durable local QA adapters; Gmail transport via authenticated connector. Production commercial guards remain active; no buyer, quote approval or payment inferred.'};
}
const body={caseId:db.caseId,kind:'CLIENTE_SINTETICO',role,at:new Date().toISOString(),inputMessageId:input.gmail.messageId,previousDigest:previous?.digest||null,result};
const receipt={...body,digest:hash(body)};db.receipts.push(receipt);await save();
await writeFile(`${root}/${role}.json`,JSON.stringify(receipt,null,2));
console.log(JSON.stringify({role,digest:receipt.digest,status:result.execution?.receipt.outcome||result.status||result.commercialResult,inputMessageId:input.gmail.messageId,blockers:result.execution?.receipt.blockers||[],artifact:`${root}/${role}.json`}));

import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createGoogleAdkTeam} from '../../lib/google_adk_agents.js';
import {createRsiExecutor} from '../../lib/rsi_agent_executor.js';
import {createCommercialRelay,relayId} from '../../lib/commercial_relay.js';
import {CAS_SCRIPT,createHandoffStore} from '../../lib/rsi_handoff_store.js';
import {createRsi03Closing,signClosingApproval,validateClosingApproval} from '../../lib/rsi03_closing.js';
assert.equal(globalThis.__BOLTECH_QA_NETWORK_DENIED,true,'QA_GUARD_REQUIRED');
const caseId=process.argv[2],stage=process.argv.find(x=>x.startsWith('--stage='))?.slice(8);
const stages=['RSI-01','RSI-02-HOLD','DIRECTORA','RSI-02-TRANSFER','RSI-03','VERIFY'];
assert.match(caseId||'',/^QA-[a-zA-Z0-9-]{1,70}$/);assert.ok(stages.includes(stage));
const root=new URL(`../../ops-output/synthetic-qa/${caseId}/`,import.meta.url);await mkdir(root,{recursive:true});
const lock=new URL('relay.lock',root),handle=await open(lock,'wx'),file=new URL('relay-state.json',root);
try {
const now=()=>new Date().toISOString(),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const WORK='tblHVqUMifOFjlGvj',LEADS='tblZaox2MX5uYA5PZ',opp='rec00000000000002',approvalId='rec00000000000001',buyer='buyer@boltech.invalid',sender='ricardo.boltechgroup@gmail.com',signingKey='isolated-qa-only-not-a-production-key';
let db;try{db=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!db){assert.equal(stage,'RSI-01');db={scope:'ISOLATED_SYNTHETIC_RELAY',caseId,kv:{},sets:{},receipts:[],mailReads:[],simulatedGatewayReads:0,originalLead:{id:opp,fields:{Name:'Cliente Sintético','Data Quality':'QA','Contact Email':buyer}},message:{id:'synthetic-reply',from:buyer,to:sender,threadId:'synthetic-thread',rfcMessageId:'<synthetic-reply@boltech.invalid>',subject:'CLIENTE SINTÉTICO — consulta',text:'[CLIENTE SINTÉTICO] Queremos organizar consultas, recopilar datos faltantes y asignar responsables.',receivedAt:now(),sent:false,automatic:false,transport:'SIMULATED_LOCAL'},tables:{[WORK]:['RSI-01','RSI-02','RSI-03','MARKETING'].map((RSI,i)=>({id:'recQaBootstrap'+i,fields:{RSI,'Work ID':'BOOTSTRAP:'+RSI,Status:'QA_ONLY',Evidence:'ISOLATED_SYNTHETIC_RELAY',Authorization:'QA only'}}))}};}
assert.equal(db.scope,'ISOLATED_SYNTHETIC_RELAY');assert.equal(db.caseId,caseId);
const save=async()=>{await writeFile(new URL('relay.tmp',root),JSON.stringify(db,null,2));await rename(new URL('relay.tmp',root),file);};
const existing=db.receipts.find(r=>r.stage===stage);if(existing){console.log(JSON.stringify({scope:db.scope,stage,reused:true,receipt:existing}));}
else {
 assert.equal(stage,stages[db.receipts.length],'QA_PHASE_ORDER_INVALID');
 const projection={id:opp,fields:{Name:'Isolated QA buyer projection','Data Quality':'QA_ISOLATED_PROJECTION','Contact Email':buyer,'Experiment Cohort':'RSI-01',Notes:'Synthetic contract projection; not a production prospect',qaCaseId:caseId}};
 const command=async a=>{const [op,k,v]=a;
  if(op==='GET')return db.kv[k]??null;
  if(op==='SET'){if(a.includes('NX')&&db.kv[k]!==undefined)return null;db.kv[k]=v;await save();return 'OK';}
  if(op==='SADD'){db.sets[k]=[...new Set([...(db.sets[k]||[]),v])];await save();return 1;}
  if(op==='SMEMBERS')return db.sets[k]||[];
  if(op==='EVAL'){
   if(k===CAS_SCRIPT){const row=JSON.parse(db.kv[a[3]]);if(row.version!==Number(a[4]))return 'CONFLICT';db.kv[a[3]]=a[5];}
   else if(a[2]===2){if(db.kv[a[3]]!==a[5])return 'LEASE_LOST';db.kv[a[4]]=a[6];}
   else if(db.kv[a[3]]===a[4])delete db.kv[a[3]];
   await save();return 'OK';
  }throw Error('QA_COMMAND_DENIED');
 };
 const request=async(table,opts={})=>{
  assert.ok([WORK,LEADS].includes(table));
  if(opts.method==='PATCH'){assert.equal(table,WORK);const changed=opts.body.records.map(r=>{const row=db.tables[WORK].find(w=>w.id===r.id);assert.ok(row);Object.assign(row.fields,r.fields);return row;});await save();return {records:structuredClone(changed)};}
  assert.ok(!opts.method||opts.method==='GET');return {records:structuredClone(table===WORK?db.tables[WORK]:[projection])};
 };
 const gmail={verify:async()=>({verified:true,scope:'SIMULATED_LOCAL_NOT_OAUTH'}),message:async id=>{assert.equal(id,db.message.id);db.mailReads.push({stage,id,at:now(),transport:'SIMULATED_LOCAL'});await save();return structuredClone(db.message);},send:async()=>{throw Error('QA_OUTBOUND_DENIED');}};
 const env={INTERAGENT_ROLE_KEYS:JSON.stringify({DIRECTORA:signingKey})};
 const closer=createRsi03Closing({command,gmail,lead:async id=>{assert.equal(id,opp);return projection;},gateway:async()=>{db.simulatedGatewayReads++;await save();return {status:'PASSED',productive:true,scope:'SIMULATED_GATEWAY_NOT_WOMPI'};},checkout:async()=>{throw Error('QA_PAYMENT_DENIED');},order:async()=>null,verifyPayment:async()=>false,coordinator:{},env});
 const relay=createCommercialRelay({command,request,gmail,env,registerClosing:closer.register});
 const store=createHandoffStore(command),a1id=relayId('RSI-01','RSI-02',opp,db.message.id),a2id=relayId('RSI-02','RSI-03',opp,approvalId);
 let result;
 if(stage==='DIRECTORA'){
  const at=now(),a={kind:'RSI03_CLOSE_APPROVED',approvedBy:'DIRECTORA',approvalRecordId:approvalId,opportunityId:opp,quoteReference:caseId,productId:'custom',customerEmail:buyer,approvedAt:at,expiresAt:new Date(Date.parse(at)+86400000).toISOString(),approvedAmountUsd:1,totalAmountUsd:2,scope:{summary:'CLIENTE SINTÉTICO: organizar consultas; simulación sin contratación',deliveryDays:1,acceptanceCriteria:['Registrar y asignar una consulta QA'],exclusions:['Sin cobros ni clientes reales']},qualificationMessageId:db.message.id,technicalEvidenceRef:'qa-tech',accessEvidenceRef:'qa-access',costs:{totalUsd:0,currency:'USD',evidenceRef:'qa-cost'}};
  const row={id:approvalId,fields:{RSI:'RSI-03',Status:'QA_ONLY',Authorization:JSON.stringify({...a,signature:signClosingApproval(a,signingKey)})}};
  const tampered=structuredClone(row),bad=JSON.parse(tampered.fields.Authorization);bad.totalAmountUsd=99;tampered.fields.Authorization=JSON.stringify(bad);assert.throws(()=>validateClosingApproval(tampered,env),/DIRECTOR_SIGNATURE/);
  db.tables[WORK].push(row);await save();result={approvalRecordId:approvalId,signedQaApproval:true,tamperedSignatureRejected:true,productionApproval:false};
 }else if(stage==='VERIFY'){
  const first=await store.read(a1id),second=await store.read(a2id),closing=JSON.parse(db.kv['boltech:closing:case:'+opp]);
  for(const h of [first,second]){assert.equal(h.state,'COMPLETED');assert.deepEqual(h.events.map(e=>e.state),['PENDING','ACCEPTED','COMPLETED']);assert.equal(h.version,3);}
  assert.equal(closing.approvalRecordId,approvalId);assert.equal(Object.keys(db.kv).filter(k=>k.startsWith('boltech:closing:case:')).length,1);
  for(let i=0;i<db.receipts.length;i++){const {digest,...body}=db.receipts[i];assert.equal(hash(body),digest);assert.equal(body.previous,i?db.receipts[i-1].digest:null);}
  assert.equal(db.receipts.filter(r=>r.result.execution).length,4);
  result={status:'ISOLATED_AGENT_RELAY_CHAIN_PASS',handoffs:2,completedHandoffs:2,actualExecutorCycles:4,closingCases:1,mailTransport:'SIMULATED_LOCAL',simulatedGateway:true,productionWrites:0,realEmails:0,payments:0,productionAutonomyCertified:false};
 }else {
  if(stage==='RSI-01')await assert.rejects(relay.run('RSI-01',{leads:[db.originalLead],followup:{results:[{state:'CUSTOMER_REPLY',opportunityId:opp,evidenceRef:db.message.id}]}}),/RELAY_CUSTOMER_EXCLUDED/);
  const executor=createRsiExecutor({command,request,followups:async()=>({enabled:true,results:[{state:'CUSTOMER_REPLY',opportunityId:opp,evidenceRef:db.message.id}]}),relay:relay.run,marketingCycle:async()=>({reviewed:0,results:[]}),costs:async()=>({complete:false}),sales:async()=>({paidOrders:0,cashCollectedUsd:0}),partners:async()=>[],referrals:async()=>[],closing:async()=>({state:'QA_REGISTRATION_ONLY'})});
  const role=stage.startsWith('RSI-02')?'RSI-02':stage;
  const execution=await createGoogleAdkTeam({execute:executor.run}).run({rsi:role,cycleId:caseId+'-'+stage});
  assert.equal(execution.receipt.outcome,'COMPLETED');assert.equal(execution.orchestration.modelCalls,0);
  const handoff=await store.read(stage==='RSI-03'?a2id:a1id);
  assert.equal(handoff.state,stage==='RSI-01'?'PENDING':stage==='RSI-02-HOLD'?'ACCEPTED':'COMPLETED');
  if(stage==='RSI-02-HOLD'){assert.equal(await store.read(a2id),null);assert.ok(execution.receipt.blockers.includes('WAITING_DIRECTOR_SCOPE_APPROVAL'));}
  if(stage==='RSI-02-TRANSFER')assert.equal((await store.read(a2id)).state,'PENDING');
  if(stage==='RSI-03'){const registered=JSON.parse(db.kv['boltech:closing:case:'+opp]);assert.equal(registered.approvalRecordId,approvalId);}
  result={execution,handoff,originalSyntheticGuardPreserved:true,projection:'QA_ISOLATED_PROJECTION',transport:'SIMULATED_LOCAL'};
 }
 const body={caseId,stage,scope:db.scope,at:now(),previous:db.receipts.at(-1)?.digest??null,result};const receipt={...body,digest:hash(body)};db.receipts.push(receipt);await save();
 await writeFile(new URL('relay-'+stage+'.json',root),JSON.stringify(receipt,null,2));
 console.log(JSON.stringify({scope:db.scope,stage,reused:false,receipt}));
}
}finally{await handle.close();await unlink(lock);}

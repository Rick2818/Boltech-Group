import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHandoffStore,CAS_SCRIPT} from '../../lib/rsi_handoff_store.js';
import {createRsiExecutor} from '../../lib/rsi_agent_executor.js';
import {createGoogleAdkTeam} from '../../lib/google_adk_agents.js';
import {createRsi01Followups} from '../../lib/rsi01_followups.js';
import {createRsi03Closing,signClosingApproval} from '../../lib/rsi03_closing.js';
import {createInteragentCoordinator,EVENT_COMMIT} from '../../lib/interagent_coordinator.js';
import {createDirectorNotifications} from '../../lib/director_notifications.js';
import {SDR_SENDER} from '../../lib/sdr_gmail.js';
import {createCommercialRelay,relayId} from '../../lib/commercial_relay.js';

// Offline integration test: every provider and persistence adapter is in memory.
// No production secrets, real customer, CRM write, mail delivery or charge is used.
let networkAttempts=0;
globalThis.fetch=async()=>{networkAttempts++;throw Error('SIMULATION_NETWORK_FORBIDDEN');};
const report={kind:'FICTIONAL_OFFLINE_INTEGRATION',date:'2026-10-08',realCustomer:false,realRevenueUsd:0,steps:[],automaticChainComplete:false,manualSimulationInterventions:[],status:'RUNNING'};
const data=new Map(),index=new Map();let tick=0,order=null,checkouts=0;
const now=()=>new Date(Date.parse('2026-10-08T16:00:00Z')+tick++*1000),iso=()=>now().toISOString();
const buyer='buyer@example.test',opportunityId='rec00000000000002',directorKey='simulation-only-key';
const messages=[];
const lead={id:opportunityId,fields:{Name:'Empresa ficticia del recorrido','Contact Email':buyer,'Experiment Cohort':'RSI-01','Data Quality':'RESEARCH_ONLY','Commercial Stage':'Contacted','Source Evidence URL':'https://example.test/contact','Buyer Role':'Owner',Notes:'Initial SENT, fictional offline fixture'}};
const work=['RSI-01','RSI-02','RSI-03','MARKETING'].map((rsi,i)=>({id:`rec0000000000001${i}`,fields:{'Work ID':`BOOTSTRAP:${rsi}`,RSI:rsi,Status:'READY',Evidence:'Fictional local fixture'}}));
async function command(a){
 if(a[0]==='GET')return data.get(a[1])||null;
 if(a[0]==='SET'){if(a.includes('NX')&&data.has(a[1]))return null;data.set(a[1],a[2]);return 'OK';}
 if(a[0]==='SADD'){if(!index.has(a[1]))index.set(a[1],new Set());index.get(a[1]).add(a[2]);return 1;}
 if(a[0]==='SMEMBERS')return [...(index.get(a[1])||[])];
 if(a[0]==='ZCOUNT')return 0;
 if(a[0]==='ZADD')return 1;
 if(a[0]==='EVAL'){
  if(a[1]===CAS_SCRIPT){const row=JSON.parse(data.get(a[3])||'null');if(!row)return 'MISSING';if(row.version!==Number(a[4]))return 'CONFLICT';data.set(a[3],a[5]);return 'OK';}
  if(a[1]===EVENT_COMMIT){if(data.has(a[3]))return data.get(a[3]);if((data.get(a[4])||'')!==a[6])return 'CONFLICT';data.set(a[3],a[7]);data.set(a[4],a[8]);if(!index.has(a[5]))index.set(a[5],new Set());index.get(a[5]).add(a[3]);return a[7];}
  if(a[2]===2){if(data.get(a[3])!==a[5])return 'LEASE_LOST';data.set(a[4],a[6]);return 'OK';}
  if(a[1].includes('local raw')){if(data.get(a[3])!==a[4])return 'CONFLICT';data.set(a[3],a[5]);return 'OK';}
  if(data.get(a[3])===a[4])data.delete(a[3]);return 1;
 }
 throw Error('UNEXPECTED_SIMULATION_COMMAND');
}
const gmail={
 verify:async()=>({verified:true,sender:SDR_SENDER}),
 message:async id=>{const m=messages.find(m=>m.id===id);assert.ok(m,'Fictional message must exist');return structuredClone(m);},
 thread:async id=>structuredClone(messages.filter(m=>m.threadId===id)),
 search:async q=>{let found=messages;if(q.includes('rfc822msgid:'))found=found.filter(m=>m.rfcMessageId.replace(/[<>]/g,'')===q.split('rfc822msgid:')[1]);if(q.includes('in:sent'))found=found.filter(m=>m.sent);if(q.includes('to:'))found=found.filter(m=>m.to===buyer);return found.map(m=>({id:m.id,threadId:m.threadId}));},
 send:async job=>{assert.ok(job.email===buyer||job.email===SDR_SENDER);const id=`simulated-sent-${messages.filter(m=>m.sent).length+1}`,threadId=job.threadId||'simulation-notice-thread';messages.push({id,threadId,from:SDR_SENDER,to:job.email,sent:true,automatic:false,text:job.text,subject:job.subject,rfcMessageId:`<${job.rfcMessageId}>`,receivedAt:iso()});return {messageId:id,threadId};}
};
const record=async(id,fields)=>{assert.equal(id,opportunityId);if(fields)Object.assign(lead.fields,fields);return structuredClone(lead);};
const request=async(table,opts={})=>{if(opts.method==='PATCH'){for(const change of opts.body.records){const row=work.find(r=>r.id===change.id);assert.ok(row);Object.assign(row.fields,change.fields);}return {records:structuredClone(opts.body.records.map(r=>work.find(x=>x.id===r.id)))};}return {records:structuredClone(table==='tblHVqUMifOFjlGvj'?work:[lead])};};
const handoffs=createHandoffStore(command,iso);
const coordinator=createInteragentCoordinator({command,lead:record,order:async()=>order,acceptance:gmail.message,gmail,verifyPayment:async p=>p===order&&p.status==='PAID'&&p.providerEvidence==='SIMULATED_PROVIDER_RECEIPT',now:iso});
const closing=createRsi03Closing({command,gmail,lead:record,order:async()=>order,checkout:async a=>{checkouts++;order={orderId:'quote-'+crypto.createHash('sha256').update(a.quoteReference).digest('hex'),productId:a.productId,customerEmail:buyer,expectedAmountUsd:a.approvedAmountUsd,provider:'WOMPI_SV',environment:'production',status:'PENDING_PAYMENT',providerCheckoutUrl:'https://pay.wompi.sv/fictional-offline-fixture'};return {success:true};},gateway:async()=>({status:'PASSED',productive:true,simulated:true}),verifyPayment:async p=>p.status==='PAID'&&p.providerEvidence==='SIMULATED_PROVIDER_RECEIPT',coordinator,handoff:handoffs.create,env:{INTERAGENT_ROLE_KEYS:JSON.stringify({DIRECTORA:directorKey})},now});
let followupPlan;
const commercialRelay=createCommercialRelay({command,request,gmail,env:{INTERAGENT_ROLE_KEYS:JSON.stringify({DIRECTORA:directorKey})},now:iso,registerClosing:closing.register});
const executor=createRsiExecutor({command,request,now:iso,relay:commercialRelay.run,costs:async()=>({complete:true,totalCostUsd:200}),sales:async()=>({paidOrders:0,cashCollectedUsd:0}),partners:async()=>[],referrals:async()=>[],closing:rows=>closing.runNext(rows),followups:()=>createRsi01Followups({command,gmail,record,now,plan:followupPlan}).run(),marketingCycle:async role=>{if(role==='MARKETING')return coordinator.marketing.metrics();const rows=(await coordinator.queue(role)).pending.filter(r=>r.material);for(const row of rows){await coordinator.marketing.review({from:role,eventId:row.eventId,materialFingerprint:row.material.fingerprint});await coordinator.marketing.reconcile({from:role,eventId:row.eventId});}return {reviewed:rows.length};}});
const team=createGoogleAdkTeam({execute:executor.run});
async function cycle(role,label){const result=await team.run({rsi:role,cycleId:`fictional-${label}`});assert.equal(result.receipt.outcome,'COMPLETED');return JSON.parse(work.find(w=>w.fields.RSI===role&&w.fields['Work ID']===`BOOTSTRAP:${role}`).fields['Execution Receipt']);}
function step(role,label,result,driver=false){report.steps.push({role,label,result,trigger:driver?'SIMULATION_DRIVER':'EXISTING_AGENT_CODE'});}
try{
 const support=await coordinator.submit({eventId:'simulation-marketing',opportunityId,from:'RSI-01',type:'SUPPORT_REQUEST',problem:'SUPPORT_NEEDED'});
 messages.push({id:'simulation-initial',threadId:'simulation-customer-thread',from:SDR_SENDER,to:buyer,sent:true,automatic:false,text:'Fictional initial contact',subject:'Fictional process question',rfcMessageId:'<simulation-initial@example.test>',receivedAt:'2026-10-06T15:00:00Z'});
 followupPlan={enabled:true,authorization:'Fictional local test only',maxPerCycle:1,accounts:[{recordId:opportunityId,email:buyer,originalMessageId:'simulation-initial',dueAt:'2026-10-08T15:00:00Z',expiresAt:'2026-10-09T23:00:00Z',text:support.material.materials.es.text}]};
 const first=await cycle('RSI-01','contact');assert.equal(JSON.parse(first.actions.find(a=>a.type==='RSI01_PROACTIVE_FOLLOWUP').result).results[0].state,'SENT');step('RSI-01','Authorized fictional follow-up','SENT_IN_MEMORY');
 messages.push({id:'simulation-qualification',threadId:'simulation-customer-thread',from:buyer,to:SDR_SENDER,sent:false,automatic:false,text:'Queremos registrar solicitudes, asignar un responsable y conservar el siguiente paso. Recibimos diez por día y hoy lo copiamos manualmente.',subject:'Fictional process question',rfcMessageId:'<simulation-qualification@example.test>',receivedAt:iso()});
 const second=await cycle('RSI-01','reply');assert.equal(JSON.parse(second.actions.find(a=>a.type==='RSI01_PROACTIVE_FOLLOWUP').result).results[0].state,'CUSTOMER_REPLY');assert.equal(lead.fields['Commercial Stage'],'Replied');step('RSI-01','Read customer reply and register RSI-02 next action','PASS');
 const firstHandoff=relayId('RSI-01','RSI-02',opportunityId,'simulation-qualification');assert.equal((await handoffs.read(firstHandoff)).state,'PENDING');step('RSI-01 → RSI-02','Automatic durable commercial handoff','PASS');

 work.push({id:'rec00000000000003',fields:{RSI:'RSI-02',Status:'AUDIT_ACCEPTED',Authorization:JSON.stringify({kind:'RESPONSE_LOG_ANALYSIS',accepted:true,evidenceRef:'simulation-response-log',samples:[{receivedAt:'2026-10-08T15:00:00Z',usefulResponseAt:'2026-10-08T15:10:00Z'}]})}});
 const diagnosis=await cycle('RSI-02','diagnosis');assert.ok(diagnosis.actions.some(a=>a.type==='AUDIT_ANALYZED'));step('RSI-02','Authorized diagnosis and report persistence','PASS');assert.equal([...data.keys()].filter(k=>k.startsWith('boltech:rsi:handoff:')).length,1);assert.equal((await handoffs.read(firstHandoff)).state,'ACCEPTED');assert.equal(checkouts,0);step('RSI-02','Wait for Director approval without inventing price or scope','PASS');
 const approval={kind:'RSI03_CLOSE_APPROVED',approvedBy:'DIRECTORA',approvalRecordId:'rec00000000000001',opportunityId,quoteReference:'simulation-quote',productId:'custom',customerEmail:buyer,approvedAt:iso(),expiresAt:'2026-10-09T23:00:00Z',totalAmountUsd:990,approvedAmountUsd:495,scope:{summary:'Fictional single request intake workflow',deliveryDays:14,acceptanceCriteria:['Register request and responsible person'],exclusions:['Extra integrations']},technicalEvidenceRef:'simulation-technical-check',accessEvidenceRef:'simulation-access-check',qualificationMessageId:'simulation-qualification',costs:{totalUsd:200,currency:'USD',evidenceRef:'simulation-costs'}};
 const approvalRow={id:approval.approvalRecordId,fields:{RSI:'RSI-03',Authorization:JSON.stringify({...approval,signature:signClosingApproval(approval,directorKey)})}};work.push(approvalRow);report.manualSimulationInterventions.push({role:'DIRECTORA',reason:'Individual signed approval, costs and technical evidence supplied as fictional test fixtures.'});
 await cycle('RSI-02','approved-handoff');const secondHandoff=relayId('RSI-02','RSI-03',opportunityId,approvalRow.id);assert.equal((await handoffs.read(firstHandoff)).state,'COMPLETED');assert.equal((await handoffs.read(secondHandoff)).state,'PENDING');step('RSI-02 → RSI-03','Automatic signed approved-case handoff','PASS');await cycle('RSI-03','proposal');assert.equal((await handoffs.read(secondHandoff)).state,'COMPLETED');const registered=JSON.parse(data.get('boltech:closing:case:'+opportunityId));assert.equal(JSON.parse(data.get(`boltech:closing:case:${opportunityId}`)).state,'PROPOSAL_SENT');assert.equal(checkouts,0);step('RSI-03','Written approved proposal','PASS');
 messages.push({id:'simulation-auto-reply',threadId:'simulation-customer-thread',from:buyer,to:SDR_SENDER,sent:false,automatic:true,text:registered.acceptanceToken,rfcMessageId:'<simulation-auto@example.test>',receivedAt:iso()});await cycle('RSI-03','automatic-rejection');assert.equal(checkouts,0);step('RSI-03','Automatic reply cannot authorize payment','PASS');
 messages.push({id:'simulation-acceptance',threadId:'simulation-customer-thread',from:buyer,to:SDR_SENDER,sent:false,automatic:false,text:registered.acceptanceToken,rfcMessageId:'<simulation-acceptance@example.test>',receivedAt:iso()});
 await cycle('RSI-03','acceptance');await cycle('RSI-03','checkout');assert.equal(checkouts,1);await cycle('RSI-03','payment-link');await cycle('RSI-03','await-payment');assert.equal((await coordinator.queue('DIRECTORA')).pending.length,0);step('RSI-03','Acceptance, single fictional checkout and unpaid hold','PASS');
 Object.assign(order,{status:'PAID',providerTransactionId:'simulation-transaction',providerEvidence:'SIMULATED_PROVIDER_RECEIPT',paidAt:iso()});await cycle('RSI-03','paid');const close=(await coordinator.queue('DIRECTORA')).pending[0];assert.equal(close.ricardoNotified,false);step('RSI-03','Verified fictional provider receipt to Director queue','PASS');
 const director=createDirectorNotifications({command,gmail,coordinator,now:iso});assert.equal((await director.run()).status,'RICARDO_NOTICE_VERIFIED');assert.equal((await director.run()).notified,0);assert.equal(messages.filter(m=>m.to===SDR_SENDER&&m.sent).length,1);step('DIRECTORA → RICARDO','One fictional notice with verified receipt; replay does not duplicate','PASS');
 const metrics=await coordinator.marketing.metrics();assert.deepEqual([metrics.accepted,metrics.used,metrics.resultsVerified],[1,1,1]);step('MARKETING','Acceptance → actual fixture use → fixture customer reply',metrics);
 assert.equal(checkouts,1);assert.equal(networkAttempts,0);report.automaticChainComplete=true;report.status='AUTOMATIC_CHAIN_PASS_WITH_SIMULATED_DIRECTOR_APPROVAL';
}catch(error){report.status='FAIL';report.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally{report.networkAttempts=networkAttempts;report.realEmailsSent=0;report.realCharges=0;report.modelCalls=0;report.simulatedCheckoutCount=checkouts;await mkdir('ops-output',{recursive:true});await writeFile('ops-output/fictional-commercial-journey.json',JSON.stringify(report,null,2));const md=`# Recorrido comercial ficticio\n\nEstado: ${report.status}\n\nDatos y proveedores aislados en memoria. Correos reales: 0. Cobros reales: 0. Llamadas a modelos: 0.\n\n| Responsable | Paso | Resultado | Activación |\n|---|---|---|---|\n${report.steps.map(s=>`| ${s.role} | ${s.label} | ${typeof s.result==='string'?s.result:JSON.stringify(s.result)} | ${s.trigger} |`).join('\n')}\n\nLa prueba de módulos no certifica la cadena automática en producción. Intervenciones del simulador: ${JSON.stringify(report.manualSimulationInterventions)}.\n`;await writeFile('ops-output/fictional-commercial-journey.md',md);console.log(JSON.stringify({status:report.status,steps:report.steps,manualSimulationInterventions:report.manualSimulationInterventions,networkAttempts,realEmailsSent:0,realCharges:0,modelCalls:0,error:report.error?.message}));}

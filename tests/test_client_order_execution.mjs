import test from 'node:test';
import assert from 'node:assert/strict';
import { checkClientOrderStorage, createClientOrderExecution, githubDeliveryEvidence } from '../lib/client_order_execution.js';
const at='2026-10-17T00:20:00.000Z',commit='a'.repeat(40);
function fixture(){
 const data=new Map(),messages=new Map();
 const command=async a=>{if(a[0]==='GET')return data.get(a[1])||null;if(a[0]==='SET'){if(a.includes('NX')&&data.has(a[1]))return null;data.set(a[1],a[2]);return 'OK';}if(a[0]==='EVAL'){const r=JSON.parse(data.get(a[3])||'null');if(r?.version!==Number(a[4]))return 'CONFLICT';data.set(a[3],a[5]);return 'OK';}throw Error('UNEXPECTED_COMMAND');};
 const closing={orderId:'quote-unit-001',opportunityId:'rec00000000000002',acceptanceMessageId:'accept-offer',acceptanceToken:'ACEPTO BOLTECH-123',threadId:'original-thread',proposal:{sentAt:'2026-10-16T20:00:00Z'},approval:{customerEmail:'buyer@example.test',quoteReference:'Q-001',approvedAmountUsd:100,productId:'custom',expiresAt:'2026-10-20T00:00:00Z',scope:{summary:'Quote registration agent',deliveryDays:7,acceptanceCriteria:['Records a quotation']}}};
 messages.set('accept-offer',{id:'accept-offer',from:'buyer@example.test',text:closing.acceptanceToken,threadId:closing.threadId,receivedAt:at,sent:false,automatic:false});
 let paid={orderId:closing.orderId,status:'PAID',environment:'production',productId:'custom',customerEmail:'buyer@example.test',expectedAmountUsd:100,providerEvidence:{verified:true},paidAt:at,providerTransactionId:'transaction-001'};
 const options={command,verifyFactoryReadiness:async ({order,evidenceRef})=>({orderId:order.orderId,customerId:order.customerId,orderFingerprint:order.fingerprint,planCommit:order.plan.commit,tenantId:'tenant-a',buildId:'build-a',artifactDigest:'b'.repeat(64),isolated:true,qaPassed:true,accessible:true,evidenceRef}),gmail:{message:async id=>messages.get(id)},payment:async()=>paid,now:()=>at,verifyQa:async(runId,r)=>({runId,commit:r.plan.commit,artifactId:1,url:'https://github.com/Rick2818/Boltech-Group/actions/runs/42',verifiedAt:at})};
 return {options,worker:createClientOrderExecution(options),closing,messages,data,setPayment:p=>paid=p};
}
async function action(f,operation,extra={}){const r=await f.worker.read(f.closing.orderId);return f.worker.act({orderId:r.orderId,expectedVersion:r.version,eventId:`event-${r.version}-${operation}`,operation,...extra});}
async function ready(f){await f.worker.register(f.closing);await action(f,'approve-plan',{owner:'E1',commit,tests:['tests/test_client_order_execution.mjs']});await action(f,'qa',{runId:42});}
test('accepted offer persists an immutable order; new worker resumes without losing state',async()=>{const f=fixture(),r=await f.worker.register(f.closing);assert.equal(r.execution,'WAITING_IMPLEMENTATION');assert.equal(r.payment,'UNVERIFIED');assert.equal((await createClientOrderExecution(f.options).register(f.closing)).version,1);const changed=structuredClone(f.closing);changed.approval.scope.summary='different scope';await assert.rejects(f.worker.register(changed),/SCOPE_CONFLICT/);});
test('forged or automatic offer acceptance cannot create work',async()=>{const f=fixture();f.messages.get('accept-offer').automatic=true;await assert.rejects(f.worker.register(f.closing),/ACCEPTANCE_UNVERIFIED/);assert.equal(f.data.size,0);});
test('approved implementation, QA, payment, actual sent receipt and distinct buyer delivery acceptance',async()=>{const f=fixture();await ready(f);let r=await f.worker.read(f.closing.orderId);assert.equal(r.delivery,'NOT_DELIVERED');await assert.rejects(action(f,'deliver',{messageId:'sent'}),/NOT_READY/);await action(f,'payment');await action(f,'factory-ready',{evidenceRef:'verified-factory-receipt'});r=await f.worker.read(f.closing.orderId);f.messages.set('sent',{id:'sent',sent:true,from:'ricardo.boltechgroup@gmail.com',to:'buyer@example.test',text:`Q-001 ${r.qa.url}`,threadId:'delivery-thread',receivedAt:at});r=await action(f,'deliver',{messageId:'sent'});assert.equal(r.customerAcceptance,'PENDING');f.messages.set('accept-delivery',{id:'accept-delivery',from:'buyer@example.test',text:`ACEPTO ENTREGA ${r.orderId}`,sent:false,automatic:false,threadId:'delivery-thread',receivedAt:at});r=await action(f,'accept-delivery',{messageId:'accept-delivery'});assert.equal(r.payment,'PAID');assert.equal(r.delivery,'DELIVERED');assert.equal(r.customerAcceptance,'ACCEPTED');});
test('CAS prevents concurrent overwrites; event replay is idempotent and conflicting replay fails',async()=>{const f=fixture(),r=await f.worker.register(f.closing),input={orderId:r.orderId,expectedVersion:1,eventId:'plan-1',operation:'approve-plan',owner:'E1',commit,tests:['tests/test_client_order_execution.mjs']};const results=await Promise.allSettled([f.worker.act(input),f.worker.act({...input,eventId:'plan-2'})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await f.worker.act(input)).version,2);assert.equal((await f.worker.act({...input,expectedVersion:2})).version,2);await assert.rejects(f.worker.act({...input,owner:'other'}),/EVENT_CONFLICT/);});
test('failed QA blocks; a reconstructed worker can recover using verified QA evidence',async()=>{const f=fixture();await ready(f);await action(f,'block',{reason:'API unavailable'});f.worker=createClientOrderExecution({...f.options,verifyQa:async()=>{throw Error('API_DOWN');}});await assert.rejects(action(f,'qa',{runId:42}),/API_DOWN/);assert.equal((await f.worker.read(f.closing.orderId)).execution,'BLOCKED');f.worker=createClientOrderExecution(f.options);assert.equal((await action(f,'qa',{runId:42})).execution,'QA_PASSED');});
test('wrong amount, account, test payment and absent provider evidence cannot mark paid',async()=>{for(const patch of [{expectedAmountUsd:1},{customerEmail:'other@example.test'},{environment:'test'},{productId:'payment-verification'},{providerEvidence:null}]){const f=fixture();await f.worker.register(f.closing);f.setPayment({orderId:f.closing.orderId,status:'PAID',environment:'production',productId:'custom',customerEmail:'buyer@example.test',expectedAmountUsd:100,providerEvidence:{verified:true},paidAt:at,providerTransactionId:'tx',...patch});await assert.rejects(action(f,'payment'),/PAYMENT_UNVERIFIED/);}});
test('arbitrary commands, traversal tests and incomplete criteria cannot become an execution plan',async()=>{for(const tests of [['../evil.mjs'],['tests/../evil.mjs'],[],['tests/a.mjs','tests/b.mjs']]){const f=fixture();await f.worker.register(f.closing);await assert.rejects(action(f,'approve-plan',{owner:'E1',commit,tests}),/APPROVED_PLAN_REQUIRED/);}});
test('delivery cannot be inferred from payment; quoted or conditional acceptance does not close order',async()=>{const f=fixture();await ready(f);await action(f,'payment');await assert.rejects(action(f,'accept-delivery',{messageId:'accept-offer'}),/NOT_DELIVERED/);await assert.rejects(action(f,'deliver',{messageId:'accept-offer'}),/FACTORY_NOT_READY/);await action(f,'factory-ready',{evidenceRef:'verified-factory-receipt'});await assert.rejects(action(f,'deliver',{messageId:'accept-offer'}),/SENT_RECEIPT_REQUIRED/);});
test('GitHub QA receipt checks trusted workflow, main branch, finished execution and bound artifact',async()=>{const f=fixture();await ready(f);const record=await f.worker.read(f.closing.orderId);const run={repository:{full_name:'Rick2818/Boltech-Group'},head_repository:{full_name:'Rick2818/Boltech-Group'},head_branch:'main',event:'workflow_dispatch',path:'.github/workflows/client_delivery_certification.yml',head_sha:commit,created_at:at};const artifacts={artifacts:[{id:9,name:`client-delivery-${record.orderId}-${commit}`,expired:false}]};const fetcher=async url=>({ok:true,json:async()=>url.includes('/jobs?')?{jobs:[{name:'execute-approved-order',conclusion:'success'}]}:url.includes('/artifacts?')?artifacts:run});assert.equal((await githubDeliveryEvidence(42,record,fetcher)).artifactId,9);run.head_branch='feature';await assert.rejects(githubDeliveryEvidence(42,record,fetcher),/QA_EVIDENCE_UNVERIFIED/);run.head_branch='main';artifacts.artifacts[0].expired=true;await assert.rejects(githubDeliveryEvidence(42,record,fetcher),/QA_EVIDENCE_UNVERIFIED/);});
test('storage failure never returns a completed order',async()=>{const f=fixture();const worker=createClientOrderExecution({...f.options,command:async()=>{throw Error('REDIS_DOWN');}});await assert.rejects(worker.register(f.closing),/REDIS_DOWN/);});

test('blocked implementation can be corrected with a new approved SHA while retaining prior plan and clearing old QA',async()=>{const f=fixture();await ready(f);await action(f,'block',{reason:'Customer criterion failed'});const r=await action(f,'approve-plan',{owner:'E1',commit:'b'.repeat(40),tests:['tests/test_client_order_execution.mjs']});assert.equal(r.previousPlans[0].commit,commit);assert.equal(r.qa,undefined);assert.equal(r.execution,'READY_FOR_BUILD_AND_QA');});

test('production storage probe uses an isolated expiring namespace, checks CAS and always cleans it',async()=>{const data=new Map();const calls=[];const command=async a=>{calls.push(a);if(a[0]==='SET'){data.set(a[1],a[2]);return 'OK';}if(a[0]==='GET')return data.get(a[1]);if(a[0]==='DEL')return data.delete(a[1]);if(a[0]==='EVAL'){if(JSON.parse(data.get(a[3])).version!==Number(a[4]))return 'CONFLICT';data.set(a[3],a[5]);return 'OK';}};const r=await checkClientOrderStorage(command);assert.equal(r.status,'VERIFIED');assert.equal(r.customerDeliveryCertified,false);assert.equal(data.size,0);assert.ok(calls[0][1].startsWith('boltech:qa:delivery:'));assert.ok(calls[0].includes('EX'));});

test('server derives stable customer identity from accepted email; caller cannot override',async()=>{
 const f=fixture();f.closing.customerId='forged-browser-id';f.closing.approval.customerId='forged-browser-id';
 const r=await f.worker.register(f.closing);
 assert.match(r.customerId,/^email-sha256:[a-f0-9]{64}$/);
 assert.notEqual(r.customerId,'forged-browser-id');
});
test('delivery cannot succeed with payment and QA but no verified tenant and build',async()=>{
 const f=fixture();await ready(f);await action(f,'payment');
 let r=await f.worker.read(f.closing.orderId);
 f.messages.set('sent',{id:'sent',sent:true,from:'ricardo.boltechgroup@gmail.com',to:'buyer@example.test',text:`Q-001 ${r.qa.url}`,threadId:'thread',receivedAt:at});
 await assert.rejects(action(f,'deliver',{messageId:'sent'}),/FACTORY_NOT_READY/);
 assert.equal((await f.worker.read(r.orderId)).delivery,'NOT_DELIVERED');
});
test('factory readiness cannot be forged without an independent evidence verifier',async()=>{
 const f=fixture();await ready(f);
 f.worker=createClientOrderExecution({...f.options,verifyFactoryReadiness:async()=>{throw Error('BAD_EVIDENCE')}});
 await assert.rejects(action(f,'factory-ready',{evidenceRef:'fake'}),/BAD_EVIDENCE/);
 assert.equal((await f.worker.read(f.closing.orderId)).factoryReadiness,undefined);
 const g=fixture();await ready(g);
 g.worker=createClientOrderExecution({...g.options,verifyFactoryReadiness:async({order})=>({
 orderId:order.orderId,customerId:'other-tenant-owner',orderFingerprint:order.fingerprint,planCommit:order.plan.commit,
 tenantId:'tenant-x',buildId:'build-x',artifactDigest:'a'.repeat(64),isolated:true,qaPassed:true,accessible:true,evidenceRef:'fake'})});
 await assert.rejects(action(g,'factory-ready',{evidenceRef:'fake'}),/FACTORY_EVIDENCE_UNVERIFIED/);
});
test('factory readiness is invalidated on a new approved plan',async()=>{
 const f=fixture();await ready(f);await action(f,'factory-ready',{evidenceRef:'real'});
 await action(f,'block',{reason:'rebuild required'});
 const r=await action(f,'approve-plan',{owner:'E1',commit:'c'.repeat(40),tests:['tests/test_client_order_execution.mjs']});
 assert.equal(r.factoryReadiness,undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRsiExecutor, analyzeAcceptedResponseAudit } from '../lib/rsi_agent_executor.js';
import handler from '../api/partners.js';

function fixture(extra = []) {
  const data = new Map(), rows = ['RSI-01','RSI-02','RSI-03'].map((rsi,i)=>({id:`recBootstrap${i}`,fields:{'Work ID':`BOOTSTRAP:${rsi}`,RSI:rsi,Status:'BUSINESS_STATE',Evidence:'Prior history',Authorization:'Original authorization'}}));
  rows.push(...extra); let writes = 0;
  const command = async args => {
    if(args[0]==='GET')return data.get(args[1])||null;
    if(args[0]==='SET'){if(args.includes('NX')&&data.has(args[1]))return null;data.set(args[1],args[2]);return 'OK';}
    if(args[0]==='EVAL'){
      if(args[2]===2){if(data.get(args[3])!==args[5])return 'LEASE_LOST';data.set(args[4],args[6]);return 'OK';}
      if(data.get(args[3])===args[4])data.delete(args[3]);return 1;
    }
    throw new Error('Unexpected command');
  };
  const request = async(table,opts={})=>{
    if(opts.method==='PATCH'){writes++;for(const change of opts.body.records){const row=rows.find(r=>r.id===change.id);assert.ok(row);Object.assign(row.fields,change.fields);}return {records:structuredClone(opts.body.records.map(r=>rows.find(x=>x.id===r.id)))};}
    return {records:table==='tblHVqUMifOFjlGvj'?structuredClone(rows):[{id:'recLead',fields:{Name:'Actual fixture','Experiment Cohort':'RSI-01','Data Quality':'INCOMPLETE'}}]};
  };
  let tick=0;
  const options={command,request,now:()=>new Date(Date.parse('2026-10-03T20:05:00Z')+tick++*100).toISOString(),
    costs:async()=>({complete:false,totalCostUsd:null}),sales:async()=>({paidOrders:0,cashCollectedUsd:0}),partners:async()=>[],referrals:async()=>[]};
  return {data,rows,options,request,writes:()=>writes};
}
test('all three executors perform real tool contracts and preserve commercial authorization/history',async()=>{
  const f=fixture(),worker=createRsiExecutor(f.options);
  for(const rsi of ['RSI-01','RSI-02','RSI-03']){
    const result=await worker.run({rsi,cycleId:'test-cycle'});
    assert.equal(result.receipt.outcome,'COMPLETED');assert.equal(result.receipt.engine,'VERCEL_EXECUTOR');assert.ok(result.receipt.tools.some(t=>t.status==='VERIFIED'));
    const bootstrap=f.rows.find(r=>r.fields['Work ID']===`BOOTSTRAP:${rsi}`);
    assert.equal(bootstrap.fields.Status,'BUSINESS_STATE');assert.ok(bootstrap.fields.Evidence.startsWith('Prior history'));assert.match(bootstrap.fields.Evidence,/RSI_COMMERCIAL_ROUTES_V1/);assert.equal(bootstrap.fields.Authorization,'Original authorization');
  }
  assert.equal(f.writes(),9);
});
test('repeat cycle reads durable receipt without repeated tools or writes',async()=>{
  const f=fixture(),w=createRsiExecutor(f.options);
  const a=await w.run({rsi:'RSI-01',cycleId:'stable'}),writes=f.writes();
  const b=await w.run({rsi:'RSI-01',cycleId:'stable'});
  assert.deepEqual(a.receipt,b.receipt);assert.equal(b.reused,true);assert.equal(f.writes(),writes);
});
test('new hourly cycle retains one stable preparation packet and does not erase later evidence',async()=>{
  const f=fixture(),w=createRsiExecutor(f.options);
  await w.run({rsi:'RSI-02',cycleId:'hour-one'});
  f.rows[1].fields.Evidence+='\nNew customer evidence';
  const writes=f.writes();await w.run({rsi:'RSI-02',cycleId:'hour-two'});
  assert.equal(f.writes()-writes,2);assert.ok(f.rows[1].fields.Evidence.endsWith('New customer evidence'));
  assert.equal(f.rows[1].fields.Evidence.split('[RSI_COMMERCIAL_ROUTES_V1]').length,2);
});
test('lead-source outage leaves RSI-03 independent financial reads available',async()=>{
  const f=fixture();const request=async(table,opts)=>{if(table==='tblZaox2MX5uYA5PZ')throw new Error('lead source unavailable');return f.request(table,opts);};
  const r=await createRsiExecutor({...f.options,request}).run({rsi:'RSI-03',cycleId:'lead-outage'});
  assert.equal(r.receipt.outcome,'BLOCKED');assert.ok(r.receipt.tools.some(t=>t.name==='provider_confirmed_payment_ledger_read'&&t.status==='VERIFIED'));
  assert.ok(r.receipt.blockers.includes('COMMERCIAL_PREPARATION_UNAVAILABLE'));
});
test('missing Redis and conflicting leases fail before any provider write',async()=>{
  const f=fixture();f.data.set('boltech:rsi:executor-lock:RSI-01','someone-else');
  await assert.rejects(createRsiExecutor(f.options).run({rsi:'RSI-01',cycleId:'busy'}),e=>e.code==='RSI_EXECUTOR_BUSY');
  await assert.rejects(createRsiExecutor({...f.options,command:async()=>{throw new Error('Redis unavailable');}}).run({rsi:'RSI-01',cycleId:'broken'}));assert.equal(f.writes(),0);
});
test('abandoned ledger and running bootstrap require reconciliation, not a second execution',async()=>{
  const f=fixture();f.data.set('boltech:rsi:execution:RSI-01:crashed',JSON.stringify({state:'RUNNING'}));
  await assert.rejects(createRsiExecutor(f.options).run({rsi:'RSI-01',cycleId:'crashed'}),e=>e.code==='RSI_EXECUTION_RECONCILE_REQUIRED');
  f.rows[0].fields['Execution State']='RUNNING';
  await assert.rejects(createRsiExecutor(f.options).run({rsi:'RSI-01',cycleId:'another'}),e=>e.code==='RSI_EXECUTION_RECONCILE_REQUIRED');assert.equal(f.writes(),0);
});
test('accepted response data yields useful/automatic medians and a persisted report without sending',async()=>{
  const auth={accepted:true,kind:'RESPONSE_LOG_ANALYSIS',evidenceRef:'customer-log-fixture',samples:[
    {receivedAt:'2026-10-01T09:00:00Z',automaticResponseAt:'2026-10-01T09:00:02Z',usefulResponseAt:'2026-10-01T09:01:00Z'},
    {receivedAt:'2026-10-01T10:00:00Z',usefulResponseAt:'2026-10-01T10:03:00Z'},
    {receivedAt:'2026-10-01T11:00:00Z'}]};
  const report=analyzeAcceptedResponseAudit(auth);assert.equal(report.usefulMedianMs,120000);assert.equal(report.automaticMedianMs,2000);assert.equal(report.unansweredUseful,1);
  const f=fixture([{id:'recAccepted',fields:{'Work ID':'audit-fixture',RSI:'RSI-02',Status:'AUDIT_ACCEPTED',Authorization:JSON.stringify(auth),Evidence:'Preserve original evidence'}}]);
  const r=await createRsiExecutor(f.options).run({rsi:'RSI-02',cycleId:'accepted'});
  assert.equal(r.receipt.outcome,'COMPLETED');const task=f.rows.find(r=>r.id==='recAccepted');assert.equal(task.fields.Status,'AUDIT_ANALYZED');assert.match(task.fields.Evidence,/Preserve original evidence/);assert.match(task.fields.Evidence,/120000/);
});
test('unaccepted data and reversed response timestamps never become completed audits',async()=>{
  for(const a of [{accepted:false},{accepted:true,kind:'RESPONSE_LOG_ANALYSIS',evidenceRef:'fixture',samples:[{receivedAt:'2026-10-01T11:00:00Z',usefulResponseAt:'2026-10-01T10:00:00Z'}]}])assert.throws(()=>analyzeAcceptedResponseAudit(a));
  const f=fixture([{id:'recAccepted',fields:{RSI:'RSI-02',Status:'AUDIT_ACCEPTED',Authorization:'unstructured notes'}}]);
  const r=await createRsiExecutor(f.options).run({rsi:'RSI-02',cycleId:'invalid'});assert.equal(r.receipt.outcome,'BLOCKED');assert.equal(f.rows.at(-1).fields.Status,'AUDIT_ACCEPTED');
});
test('failed costs do not hide available payment ledger and do not invent margin',async()=>{
  const f=fixture();const result=await createRsiExecutor({...f.options,costs:async()=>{throw new Error('provider failure');}}).run({rsi:'RSI-03',cycleId:'partial'});
  assert.equal(result.receipt.outcome,'BLOCKED');assert.ok(result.receipt.tools.some(t=>t.name==='provider_confirmed_payment_ledger_read'&&t.status==='VERIFIED'));
  const raw=JSON.parse(f.rows[2].fields['Execution Receipt']);const evidence=JSON.parse(raw.actions.find(a=>a.type==='REFERRAL_COST_PAYMENT_REVIEW').result);
  assert.equal(evidence.costs,null);assert.equal(evidence.cash.cashCollectedUsd,0);assert.ok(raw.blockers.includes('RSI_SOURCE_UNAVAILABLE'));
});
test('lost lease cannot finalize durable success or delete another workers lock',async()=>{
  const f=fixture();let writes=0;
  const request=async(...args)=>{const value=await f.request(...args);if(args[1]?.method==='PATCH'&&++writes===2)f.data.set('boltech:rsi:executor-lock:RSI-01','new-lease');return value;};
  await assert.rejects(createRsiExecutor({...f.options,request}).run({rsi:'RSI-01',cycleId:'expired'}),e=>e.code==='RSI_EXECUTION_OWNERSHIP_LOST');
  assert.equal(f.data.get('boltech:rsi:executor-lock:RSI-01'),'new-lease');assert.equal(JSON.parse(f.data.get('boltech:rsi:execution:RSI-01:expired')).state,'RUNNING');
});
test('API rejects unauthenticated execution and invalid inputs without contacting providers',async t=>{
  const old=process.env.PARTNER_API_TOKEN;process.env.PARTNER_API_TOKEN='local-test';t.after(()=>{if(old===undefined)delete process.env.PARTNER_API_TOKEN;else process.env.PARTNER_API_TOKEN=old;});
  const response=()=>({setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}});
  const a=response();await handler({url:'/api/partners?action=rsi-execute',method:'POST',headers:{},body:{}},a);assert.equal(a.code,401);
  const b=response();await handler({url:'/api/partners?action=rsi-execute',method:'POST',headers:{authorization:'Bearer local-test'},body:{rsi:'bad',cycleId:'x'}},b);assert.equal(b.code,400);
});

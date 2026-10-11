import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveWebLead,validateReception} from '../lib/web_reception.js';
import {orientReception,receptionSteps} from '../assets/js/reception-guidance.js';
import qaCase from '../config/qa_case.json' with {type:'json'};
import {createWebRequests,webRequestExcluded} from '../lib/rsi01_web_requests.js';
const input={...Object.fromEntries(receptionSteps.map((s,i)=>[s[0],qaCase.answers[i]])),consent:true};

test('sole QA stays excluded with missing QA marker and differently cased email',async()=>{
  const lead={id:'rec12345678901234',fields:{'Contact Email':` ${input.email.toUpperCase()} `}};
  assert.equal(webRequestExcluded(lead),true);
  let providerCalls=0;
  const f=fixture();
  const worker=createWebRequests({request:async()=>{throw Error('QA_MUST_NOT_WRITE');},command:f.deps.command,
    gmail:new Proxy({},{get(){return async()=>{providerCalls++;throw Error('QA_MUST_NOT_CONTACT_PROVIDER');};}})});
  const result=await worker.run({leads:[lead],work:[{id:'rec23456789012345',fields:{RSI:'RSI-01','Work ID':`WEB_INTAKE:${qaCase.requestId}`,'Source Record ID':lead.id,Evidence:JSON.stringify({kind:'RSI01_WEB_INTAKE_V1',consent:true,...input})}}]});
  assert.equal(result.results[0].state,'CONTACT_HOLD');
  assert.equal(providerCalls,0);
});
function fixture(){
  const tables=new Map(),cache=new Map();let writes=0;
  const request=async(table,options={})=>{
    const rows=tables.get(table)||[];
    if(options.method==='PATCH'){
      writes++;const key=options.body.performUpsert.fieldsToMergeOn[0];
      const fields=options.body.records[0].fields;
      let row=rows.find(r=>r.fields[key]===fields[key]);
      if(!row){row={id:table==='tblZaox2MX5uYA5PZ'?'rec12345678901234':'rec23456789012345',fields:{}};rows.push(row);}
      Object.assign(row.fields,fields);tables.set(table,rows);return [row];
    }
    return rows;
  };
  return {tables,cache,get writes(){return writes;},deps:{request,queue:async()=>{throw Error('QA_MUST_NOT_SYNC');},command:async([op,key,value,...args])=>{if(op==='GET')return cache.get(key)||null;if(op==='EVAL'){if(cache.get(args[0])===args[1])cache.delete(args[0]);return 1;}if(args.includes('NX')&&cache.has(key))return null;cache.set(key,value);return 'OK';},now:()=> '2026-10-10T18:00:00Z'}};
}
test('golden-rule diagnosis covers process, impact, tools, decision, result and limits',()=>{
  assert.deepEqual(receptionSteps.slice(0,7).map(s=>s[0]),['painPoint','workflow','impact','tools','decision','result','limits']);
  assert.match(orientReception(input.painPoint),/registrar cada consulta/);
  assert.match(orientReception(input.workflow),/comprobar formatos/);
  assert.match(orientReception(input.painPoint,'en'),/record inquiries/);
});
test('consent, bounded fields and valid contact required before persistence',async()=>{
  for(const change of [{consent:false},{email:'bad'},{painPoint:'x'},{result:''},{tools:'x'.repeat(201)}])assert.throws(()=>validateReception({...input,...change}));
});

test('optional context from the main form is retained in the same QA intake',async()=>{
  const f=fixture();
  await receiveWebLead({...input,volume:qaCase.answers[2],processOwner:qaCase.answers[4]},f.deps);
  const evidence=JSON.parse(f.tables.get('tblHVqUMifOFjlGvj')[0].fields.Evidence);
  assert.equal(evidence.volume,qaCase.answers[2]);assert.equal(evidence.processOwner,qaCase.answers[4]);
  for(const change of [{volume:'x'.repeat(61)},{processOwner:'x'.repeat(101)}]) assert.throws(()=>validateReception({...input,...change}),/INVALID_INPUT/);
});
test('web request reuses RSI-01, existing CRM tables, retains qualification and verifies assignment',async()=>{
  const f=fixture();const result=await receiveWebLead(input,f.deps);
  assert.equal(result.assignment.owner,'RSI-01');assert.equal(result.registration.status,'RECORDED');
  const work=f.tables.get('tblHVqUMifOFjlGvj')[0].fields;
  assert.equal(work['Handoff To'],'RSI-02');assert.equal(work['Source Record ID'],'rec12345678901234');
  const evidence=JSON.parse(work.Evidence);assert.equal(evidence.result,input.result);assert.equal(evidence.emailVerified,false);
  assert.deepEqual(await receiveWebLead(input,f.deps),result);assert.equal(f.writes,2);
});
test('existing customer history and stages are preserved',async()=>{
  const f=fixture();f.tables.set('tblZaox2MX5uYA5PZ',[{id:'rec12345678901234',fields:{'Contact Email':input.email,Notes:'Existing history','Commercial Stage':'Proposal sent'}}]);
  await receiveWebLead(input,f.deps);assert.equal(f.writes,1);assert.equal(f.tables.get('tblZaox2MX5uYA5PZ')[0].fields.Notes,'Existing history');
});
test('exclusions and uncertain assignment do not report successful reception',async()=>{
  const f=fixture();f.tables.set('tblZaox2MX5uYA5PZ',[{id:'rec12345678901234',fields:{'Do Not Contact':true}}]);
  await assert.rejects(receiveWebLead(input,f.deps),/CONTACT_REVIEW_REQUIRED/);
  const g=fixture(),original=g.deps.request;g.deps.request=async(t,o)=>t==='tblHVqUMifOFjlGvj'&&!o.method?[]:original(t,o);
  await assert.rejects(receiveWebLead(input,g.deps),/ASSIGNMENT_UNCONFIRMED/);
});
test('storage outage cannot create a false receipt',async()=>{
  const f=fixture();f.deps.command=async()=>{throw Error('unavailable');};
  await assert.rejects(receiveWebLead(input,f.deps));assert.equal(f.writes,0);
});

test('retry after missing cache preserves advanced role and task status',async()=>{
  const f=fixture();await receiveWebLead(input,f.deps);
  const work=f.tables.get('tblHVqUMifOFjlGvj')[0];
  work.fields.RSI='RSI-02';work.fields.Status='WAITING_DIRECTOR_APPROVAL';
  f.cache.delete(`boltech:web-reception:${qaCase.requestId}`);
  const receipt=await receiveWebLead(input,f.deps);
  assert.equal(receipt.assignment.owner,'RSI-02');assert.equal(receipt.assignment.status,'WAITING_DIRECTOR_APPROVAL');assert.equal(f.writes,2);
});
test('cached receipt never bypasses fresh exclusion checks',async()=>{
  const f=fixture();await receiveWebLead(input,f.deps);f.tables.get('tblZaox2MX5uYA5PZ')[0].fields['Do Not Contact']=true;
  await assert.rejects(receiveWebLead(input,f.deps),/CONTACT_REVIEW_REQUIRED/);
});

test('final receipt storage failure reconciles the same QA task without resetting its owner',async()=>{
  const f=fixture(),command=f.deps.command;
  let failReceipt=true;
  f.deps.command=async args=>{
    if(args[0]==='SET' && args[1]===`boltech:web-reception:${qaCase.requestId}` && failReceipt){
      failReceipt=false;
      throw Error('QA_FINAL_RECEIPT_STORAGE_FAILURE');
    }
    return command(args);
  };
  await assert.rejects(receiveWebLead(input,f.deps),/QA_FINAL_RECEIPT_STORAGE_FAILURE/);
  const row=f.tables.get('tblHVqUMifOFjlGvj')[0];
  Object.assign(row.fields,{RSI:'RSI-03',Owner:'RSI-03',Status:'WAITING_DIRECTOR_APPROVAL','Next Action':'QA: revisión interna; sin mensajes ni cobros'});
  const preserved=structuredClone(row.fields);
  const receipt=await receiveWebLead(input,f.deps);
  assert.equal(receipt.assignment.owner,'RSI-03');
  assert.equal(receipt.assignment.status,'WAITING_DIRECTOR_APPROVAL');
  assert.deepEqual(row.fields,preserved);
  assert.equal(f.writes,2);
});

test('a cached receipt reports the freshly read assignment of the same QA case',async()=>{
  const f=fixture();await receiveWebLead(input,f.deps);
  const row=f.tables.get('tblHVqUMifOFjlGvj')[0];
  row.fields.RSI='RSI-02';row.fields.Status='QA_INTERNAL_REVIEW';
  const receipt=await receiveWebLead(input,f.deps);
  assert.equal(receipt.assignment.owner,'RSI-02');
  assert.equal(receipt.assignment.status,'QA_INTERNAL_REVIEW');
  assert.equal(f.writes,2);
});

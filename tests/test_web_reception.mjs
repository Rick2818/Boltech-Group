import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveWebLead,validateReception} from '../lib/web_reception.js';
import {orientReception,receptionSteps} from '../assets/js/reception-guidance.js';
const input={email:' Visitor@example.com ',companyName:'Empresa visitante',painPoint:'Perdemos consultas entrantes',workflow:'Llega correo y lo copiamos a mano',impact:'Dos horas diarias',tools:'Correo',decision:'Gerente aprueba envíos',result:'Asignar responsable esta semana',limits:'No enviar sin aprobación',consent:true};
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
  return {tables,get writes(){return writes;},deps:{request,queue:async()=>({jobId:'a'.repeat(64),status:'PENDING'}),command:async([op,key,value])=>op==='GET'?cache.get(key)||null:(cache.set(key,value),'OK'),now:()=> '2026-10-10T18:00:00Z'}};
}
test('golden-rule diagnosis covers process, impact, tools, decision, result and limits',()=>{
  assert.deepEqual(receptionSteps.slice(0,7).map(s=>s[0]),['painPoint','workflow','impact','tools','decision','result','limits']);
  assert.match(orientReception('Perdemos consultas'),/registrar cada consulta/);
  assert.match(orientReception('Copiar PDF a Excel'),/comprobar formatos/);
  assert.match(orientReception('Una tarea distinta'),/Primero necesito conocer/);
});
test('consent, bounded fields and valid contact required before persistence',async()=>{
  for(const change of [{consent:false},{email:'bad'},{painPoint:'x'},{result:''},{tools:'x'.repeat(201)}])assert.throws(()=>validateReception({...input,...change}));
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
  const f=fixture();f.tables.set('tblZaox2MX5uYA5PZ',[{id:'rec12345678901234',fields:{'Contact Email':'visitor@example.com',Notes:'Existing history','Commercial Stage':'Proposal sent'}}]);
  await receiveWebLead(input,f.deps);assert.equal(f.writes,1);assert.equal(f.tables.get('tblZaox2MX5uYA5PZ')[0].fields.Notes,'Existing history');
});
test('exclusions and uncertain assignment do not report successful reception',async()=>{
  const f=fixture();f.tables.set('tblZaox2MX5uYA5PZ',[{id:'rec12345678901234',fields:{'Do Not Contact':true}}]);
  await assert.rejects(receiveWebLead(input,f.deps),/CONTACT_REVIEW_REQUIRED/);
  const g=fixture(),original=g.deps.request;g.deps.request=async(t,o)=>t==='tblHVqUMifOFjlGvj'&&!o.method?[]:original(t,o);
  await assert.rejects(receiveWebLead(input,g.deps),/ASSIGNMENT_UNCONFIRMED/);
});
test('storage outage cannot create a false receipt',async()=>{
  const f=fixture();f.deps.queue=async()=>{throw Error('unavailable');};
  await assert.rejects(receiveWebLead(input,f.deps));assert.equal(f.writes,0);
});

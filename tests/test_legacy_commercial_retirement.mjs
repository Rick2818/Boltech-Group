import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import partnersHandler from '../api/partners.js';

const base=new URL('../',import.meta.url);
function invoke(action,method='POST'){
 const req={method,url:'/api/partners?action='+action,headers:{host:'localhost'},body:{}};
 const response={code:200,payload:null,setHeader(){return this;},
  status(n){this.code=n;return this;},json(data){this.payload=data;return this;}};
 return Promise.resolve(partnersHandler(req,response)).then(()=>response);
}
test('all former SDR, Apollo, marketing-import and RSI execution routes fail closed',async()=>{
 for(const action of [
  'sdr-send','sdr-campaign','sdr-reconcile','rsi01-daily','rsi01-prepare',
  'commercial-activation','marketing-crm-intake','marketing-multi-source-import',
  'rsi-execute','marketing-maintenance','apollo-leads-saved','director-notify'
 ]){
  const r=await invoke(action);
  assert.equal(r.code,410,'Expected retired endpoint '+action);
  assert.equal(r.payload.code,'LEGACY_COMMERCIAL_TRACTION_RETIRED');
  assert.equal(r.payload.sendingEnabled,false);
 }
 for(const action of ['interagent','rsi-handoff']){
  const r=await invoke(action);
  assert.equal(r.code,410,action+' write must be retired');
 }
});
test('historical workflows can no longer be triggered manually or by schedule',()=>{
 for(const f of [
  '.github/workflows/agent1_autonomous_discovery.yml',
  '.github/workflows/agent1_autonomous_inbox.yml',
  '.github/workflows/explee_hot_leads_crm.yml',
  '.github/workflows/director-hourly-oversight.yml',
  '.github/workflows/apollo_production_acceptance.yml',
  '.github/workflows/audit_apollo_production.yml',
  '.github/workflows/sdr_connection_verification.yml'
 ])assert.equal(existsSync(new URL(f,base)),false,f);
 const rsi=readFileSync(new URL('.github/workflows/agent1_v2_rsi_operations.yml',base),'utf8');
 assert.doesNotMatch(rsi,/^\s*schedule:\s*$/m);
});
test('marketplace and customer-initiated web orders remain in the repository',()=>{
 const api=readFileSync(new URL('api/index.js',base),'utf8');
 const partners=readFileSync(new URL('api/partners.js',base),'utf8');
 assert.match(api,/agent1_marketplace_cycle/);
 assert.match(api,/marketing_sales_cycle_v2/);
 assert.match(partners,/action==='client-order'/);
 assert.match(api,/new WompiGateway/);
 assert.match(api,/leo_sales/);
});

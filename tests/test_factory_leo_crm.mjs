import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeoOpportunity,listLeoOpportunities} from '../lib/factory_leo_crm.js';
const owner={verified:true,tenantId:'t1',customerId:'u1'};
function db(){
  let saved; let filters=[];
  const q={
    insert(fields){saved={...fields,id:'example',status:'new',created_at:'2026-10-27'};return q},
    select(){return q},
    eq(k,v){filters.push([k,v]);return q},
    order(){return q},limit(){return q},
    async single(){return {data:saved,error:null}},
    then(resolve){return Promise.resolve({data:filters.every(([k,v])=>saved?.[k]===v)?[saved]:[],error:null}).then(resolve)}
  };
  return {from(name){assert.equal(name,'factory_leo_opportunities');filters=[];return q}};
}
test('Leo CRM stores and filters opportunities by verified identity',async()=>{
  const store=db();
  assert.equal((await createLeoOpportunity(store,owner,{title:'Industrial lead'})).status,'new');
  assert.equal((await listLeoOpportunities(store,owner)).length,1);
  assert.equal((await listLeoOpportunities(store,{...owner,tenantId:'t2'})).length,0);
  assert.equal((await listLeoOpportunities(store,{...owner,customerId:'u2'})).length,0);
});
test('Leo CRM rejects unverified contexts and bad contacts',async()=>{
  await assert.rejects(listLeoOpportunities(db(),{...owner,verified:false}),/Verified/);
  await assert.rejects(createLeoOpportunity(db(),owner,{title:'X'}),/Invalid opportunity/);
  await assert.rejects(createLeoOpportunity(db(),owner,{title:'Valid',contactEmail:'bad'}),/Invalid contact/);
});

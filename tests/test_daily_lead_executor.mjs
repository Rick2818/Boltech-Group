import test from 'node:test';import assert from 'node:assert/strict';import {createDailyLeadExecutor} from '../lib/daily_lead_executor.js';
const lead={apolloContactId:'a'.repeat(24),contactEmail:'x@example.com',company:'Example Ltd',domain:'example.com',name:'X'};
test('records only unique research candidates, not certified leads or emails',async()=>{
 let calls=0;const crm={async intake(){calls++;return {success:true,created:true,recordId:'rec'+'a'.repeat(14)};}};
 const apollo={async listSavedContacts(){return {complete:true,contacts:[lead,lead]};}};
 const result=await createDailyLeadExecutor({apollo,crm}).run();assert.equal(calls,1);assert.equal(result.newResearchCandidates,1);assert.equal(result.qualifiedLeadsCertified,0);assert.equal(result.sendingPerformed,false);});
test('provider inaccessible yields blocked status and no fabricated leads',async()=>{
 const apollo={async listSavedContacts(){throw Object.assign(Error('denied'),{code:'APOLLO_ACCESS_DENIED'});}};
 const result=await createDailyLeadExecutor({apollo,crm:{intake(){throw Error('should not run');}}}).run();assert.equal(result.newResearchCandidates,0);assert.deepEqual(result.blockers,['APOLLO_ACCESS_DENIED']);});
test('uncertain CRM write stops without retry',async()=>{
 const apollo={async listSavedContacts(){return {complete:true,contacts:[lead,{...lead,apolloContactId:'b'.repeat(24),contactEmail:'y@example.com'}]};}};
 let calls=0;const crm={async intake(){calls++;throw Error('network timeout');}};
 const result=await createDailyLeadExecutor({apollo,crm}).run();assert.equal(calls,1);assert.equal(result.newResearchCandidates,0);assert.deepEqual(result.blockers,['DAILY_LEADS_INTAKE_UNCONFIRMED']);});

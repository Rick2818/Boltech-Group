import test from 'node:test';
import assert from 'node:assert/strict';
import {createMultiSourceLeadImport} from '../lib/multi_source_lead_import.js';
const upwork={company:'Project listing',source:'Upwork',sourceUrl:'https://www.upwork.com/jobs/~example'};
const lusha={company:'Example Inc',email:'owner@example.com',source:'Lusha',sourceUrl:'https://www.lusha.com/'};
test('authorized import deduplicates within batch and never sends messages',async()=>{
 let writes=0;
 const result=await createMultiSourceLeadImport({crm:{intake:async()=>({success:true,created:true,recordId:'rec'+String(++writes).padStart(14,'a')})}}).run({items:[upwork,upwork,lusha]});
 assert.equal(writes,2);assert.equal(result.receipts[1].state,'DUPLICATE_BATCH');
 assert.equal(result.qualifiedLeadsCertified,0);assert.equal(result.sendingPerformed,false);
});
test('rejects off-platform Upwork and invalid source before writing',async()=>{
 let writes=0;const crm={intake:async()=>{writes++;}};
 const run=createMultiSourceLeadImport({crm});
 await assert.rejects(run.run({items:[lusha,{...upwork,email:'outside@example.com'}]}),{code:'MARKETING_IMPORT_UPWORK_OFF_PLATFORM_BLOCKED'});
 assert.equal(writes,0);
});
test('uncertain CRM write stops safely',async()=>{
 let writes=0;const run=createMultiSourceLeadImport({crm:{intake:async()=>{writes++;throw Error('network');}}});
 const result=await run.run({items:[lusha,upwork]});assert.equal(writes,1);
 assert.equal(result.receipts[0].state,'WRITE_UNCONFIRMED');
});

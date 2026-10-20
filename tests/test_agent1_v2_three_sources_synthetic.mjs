import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgent1LeadSources,fromApolloContacts,fromUpworkJobs,fromExpleeExport} from '../lib/agent1_v2_lead_sources.js';
import {createAgent1V2} from '../lib/agent1_v2_executor.js';
const accounts=fromApolloContacts({contacts:[{id:'a1',organization_name:'QA Example Corporation',email:'sales@qa-example.test',email_status:'verified',organization:{website_url:'https://qa-example.test'}}]});
const jobs=fromUpworkJobs({jobs:[{id:'u1',title:'Automation implementation',client:{name:'QA Buyer'},url:'https://www.upwork.com/jobs/example'}]});
const explee=fromExpleeExport([{id:'e1',company:'QA Legacy Co',email:'team@legacy-example.test',sourceUrl:'https://legacy-example.test'}]);
test('synthetic three-source end-to-end handoff does not send',async()=>{
 let sends=0;const events=[];
 const agent=createAgent1V2({redisCommand:async()=>null,mailSender:{send:async()=>{sends++;throw Error('MUST_NOT_SEND');}},crm:{recordEvent:async event=>events.push(event)}});
 const response=await agent.leadSources({apollo:async()=>accounts,upwork:async()=>jobs,explee:async()=>explee}).discover();
 assert.deepEqual(response.sources.map(s=>s.source),['APOLLO','UPWORK','EXPLEE']);
 assert.deepEqual(response.sources.map(s=>s.status),['OBSERVED','OBSERVED','OBSERVED']);
 assert.equal(response.observed,3);
 assert.equal(response.sendAllowed,false);
 for(const source of response.sources){
  assert.equal(source.candidates.length,1);
  assert.equal(source.candidates[0].contactEligible,false);
  assert.equal(source.candidates[0].sendAllowed,false);
  assert.equal(source.candidates[0].buyerVerified,false);
 }
 const upwork=response.sources[1].candidates[0];assert.equal(upwork.email,'');
 const expleeLead=response.sources[2].candidates[0];assert.equal(expleeLead.contactVerified,false);
 const preparation=await agent.prepareProspect({prospect:{company:'QA Example Corporation',country:'US',publishedBusinessContact:false,mxVerified:false,humanVerified:false,synthetic:true},evidence:{observedProcess:'manual intake',sourceUrl:'https://qa-example.test',sourceVerified:false},history:{gmail:'CLEAR',crm:'CLEAR',suppression:'CLEAR'}});
 assert.equal(preparation.research.eligible,false);
 assert.equal(preparation.draft.ready,false);
 assert.equal(sends,0);
 assert.equal(events.length,0);
 console.log('SYNTHETIC_THREE_SOURCES_CERTIFIED observed=3 sent=0');
});

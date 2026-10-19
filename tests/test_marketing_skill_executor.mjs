import test from 'node:test';
import assert from 'node:assert/strict';
import {executeMarketingSkills} from '../lib/marketing_skill_executor.js';

test('all eight Marketing skills execute and distinguish external distribution',()=>{
 const x=executeMarketingSkills({leads:[{id:'real',fields:{Name:'Acme',Country:'USA','Contact Email':'buyer@acme.example','Source Evidence URL':'https://acme.example','Commercial Stage':'Replied','Problem Confirmed':true}},{id:'qa',fields:{Name:'Synthetic Customer','Data Quality':'QA'}}],campaigns:[{id:'CUSTOM_AGENTS',status:'DRAFT_REVIEW_REQUIRED'}]});
 assert.equal(x.skills.length,8);
 assert.equal(x.skills[0].evidence.records,1);
 assert.equal(x.skills[1].evidence.verifiedNeedRecordIds[0],'real');
 assert.equal(x.skills[3].evidence.priorityRecordIds[0],'real');
 assert.equal(x.publishingPerformed,false);
 assert.equal(x.distributionCertified,false);
 assert.equal(x.skills[6].state,'BLOCKED');
});

test('external distribution requires provider publication URL and attribution',()=>{
 const x=executeMarketingSkills({providerReceipts:[{status:'PUBLISHED',providerId:'provider-123',campaignId:'CUSTOM_AGENTS',publicUrl:'https://www.linkedin.com/feed/update/urn:li:activity:123'}],siteEvents:[{type:'LEAD_CONVERSION',campaignId:'CUSTOM_AGENTS',evidenceRef:'crm:123'}]});
 assert.equal(x.distributionCertified,true);
 assert.equal(x.conversionsVerified,1);
 assert.equal(x.publishingPerformed,false);
});

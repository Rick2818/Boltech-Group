import test from 'node:test';import assert from 'node:assert/strict';import {planMarketingActions,buildMarketingBrief,marketingBriefForRole,MARKETING_SKILLS} from '../lib/marketing_autonomy.js';
test('Marketing prioritizes actual replies and safely excludes suppressions and QA',()=>{
 const leads=[{id:'rec1',fields:{Name:'Cold', 'Contact Email':'cold@example.org'}},{id:'rec2',fields:{Name:'Reply','Commercial Stage':'Replied','Contact Email':'reply@example.org'}},{id:'rec3',fields:{Name:'Block','Do Not Contact':true}},{id:'rec4',fields:{Name:'QA','Data Quality':'QA'}}];
 const p=planMarketingActions(leads);assert.equal(p.observed,2);assert.equal(p.selected[0].leadId,'rec2');assert.equal(p.selected[0].owner,'RSI-02');assert.equal(p.sendingPerformed,false);assert.equal(p.customerInterestInferred,false);assert.ok(MARKETING_SKILLS.includes('MESSAGE_PERSONALIZATION'));
});
test('Marketing excludes internal QA and El Salvador while prioritizing US follow-up',()=>{
 const rows=[
 {id:'internal',fields:{Name:'Tu chuchito','Commercial Stage':'Replied','Contact Email':'rick28191@gmail.com'}},
 {id:'sv',fields:{Name:'Tecniinox',Country:'El Salvador','Company URL':'https://tecniinox.com.sv','Commercial Stage':'Contacted'}},
 {id:'us',fields:{Name:'Marstrand Industries',Country:'United States','Company URL':'https://marstrand.us/get-a-quote/','Commercial Stage':'Contacted','Contact Email':'sales@marstrand.us'}}];
 const result=planMarketingActions(rows);assert.equal(result.observed,1);assert.equal(result.selected[0].leadId,'us');
});

test('Marketing produces two campaign briefs with 8 skills, without prospecting or sending',()=>{
 const plan=planMarketingActions([{id:'rec-qa',fields:{Name:'Sample US Company',Country:'United States','Commercial Stage':'Replied','Contact Email':'buyer@example.org'}}]);
 const brief=buildMarketingBrief(plan);
 assert.equal(brief.skillsPackaged.length,8);
 assert.equal(brief.campaigns.length,2);
 assert.equal(brief.enablement[0].recipient,'RSI-02');
 assert.equal(brief.leadSourcingPerformed,false);
 assert.equal(brief.sendingPerformed,false);
 assert.equal(brief.campaigns[0].metrics.paid,null);
 assert.equal(brief.director.status,'REVIEW_REQUIRED');
});

test('Campaign deliverable is retrieved by all three sales executors without authorizing send',()=>{
 const p=buildMarketingBrief(planMarketingActions([{id:'recBuyer',fields:{Name:'Buyer','Commercial Stage':'Replied','Contact Email':'buyer@example.org'}}]));
 const row={fields:{'Work ID':'BOOTSTRAP:MARKETING',Evidence:'[MARKETING_TEAM_SUPPORT_V1]\n'+JSON.stringify({marketingBrief:p})+'\n[/MARKETING_TEAM_SUPPORT_V1]'}};
 for(const role of ['RSI-01','RSI-02','RSI-03']){
  const result=marketingBriefForRole([row],role);
  assert.equal(result.status,'AVAILABLE_FOR_REVIEW');
  assert.equal(result.brief.sendingAuthorized,false);
  assert.equal(result.brief.campaigns.length,2);
 }
 assert.equal(marketingBriefForRole([], 'RSI-01').status,'NOT_PUBLISHED');
});

test('Synthetic commercial handoff: Marketing -> A1 -> A2 -> A3, with safe holds',()=>{
 const lead={id:'recSyntheticIsolated',fields:{Name:'Synthetic customer',Country:'United States','Commercial Stage':'Replied','Contact Email':'qa@example.invalid'}};
 const p=buildMarketingBrief(planMarketingActions([lead]));
 const published=[{fields:{'Work ID':'BOOTSTRAP:MARKETING',Evidence:'[MARKETING_TEAM_SUPPORT_V1]'+JSON.stringify({marketingBrief:p})+'[/MARKETING_TEAM_SUPPORT_V1]'}}];
 const a1=marketingBriefForRole(published,'RSI-01');
 const a2=marketingBriefForRole(published,'RSI-02');
 const a3=marketingBriefForRole(published,'RSI-03');
 assert.equal(a1.status,'AVAILABLE_FOR_REVIEW');
 assert.equal(a2.status,'AVAILABLE_FOR_REVIEW');
 assert.equal(a3.status,'AVAILABLE_FOR_REVIEW');
 assert.equal(a2.brief.recommendations.length,0); // synthetic records are excluded from targeting
 for(const role of [a1,a2,a3])assert.equal(role.brief.sendingAuthorized,false);
 assert.equal(p.director.status,'REVIEW_REQUIRED');
 assert.equal(p.campaigns.every(c=>c.metrics.sent===null&&c.metrics.paid===null),true);
});

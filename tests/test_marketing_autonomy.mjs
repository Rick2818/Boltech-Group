import test from 'node:test';import assert from 'node:assert/strict';import {planMarketingActions,buildMarketingBrief,MARKETING_SKILLS} from '../lib/marketing_autonomy.js';
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
 assert.equal(brief.skillsExecuted.length,8);
 assert.equal(brief.campaigns.length,2);
 assert.equal(brief.enablement[0].recipient,'RSI-02');
 assert.equal(brief.leadSourcingPerformed,false);
 assert.equal(brief.sendingPerformed,false);
 assert.equal(brief.campaigns[0].metrics.paid,null);
 assert.equal(brief.director.status,'REVIEW_REQUIRED');
});

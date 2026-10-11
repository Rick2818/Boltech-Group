import test from 'node:test';
import assert from 'node:assert/strict';
import {planLeadIntake} from '../lib/lead_intake.js';
const at='2026-10-09T02:00:00Z';
const lead=(fields={})=>({id:'rec00000000000001',fields:{Name:'Buyer','Source Evidence URL':'https://example.test/request',...fields}});
test('quotes, Apollo and public cohorts enter RSI01 without email or implied sending',()=>{
 for(const cohort of ['PUBLIC_PAID_REQUESTS_2026-10-08','RSI-01','RSI01:WEEKDAY_RESEARCH:2026-10-08']){
 const p=planLeadIntake([lead({'Experiment Cohort':cohort})],[],at);assert.equal(p.create[0].fields.RSI,'RSI-01');assert.equal(p.sendingPerformed,false);assert.equal(p.create[0].fields['Handoff To'],'RSI-02');}
});
test('repeated intake and existing downstream ownership do not duplicate or reset tasks',()=>{
 const l=lead(),p=planLeadIntake([l],[],at);assert.equal(planLeadIntake([l],[{id:'work',...p.create[0]}],at).create.length,0);
 assert.equal(planLeadIntake([l],[{id:'existing',fields:{RSI:'RSI-03','Source Record ID':l.id,Status:'WAITING_PAYMENT'}}],at).covered.length,1);
});
test('pending moderation never queues a replacement initial post',()=>{assert.equal(planLeadIntake([lead({'Quotation Status':'SUBMITTED_PENDING_MODERATION'})],[],at).create[0].fields.Status,'WAITING_MODERATION');});
test('QA, opted out, lost and paid accounts excluded; missing source blocked',()=>{
 for(const f of [{'Data Quality':'QA'},{'Do Not Contact':true},{'Commercial Stage':'Lost'},{'Commercial Stage':'Paid verified'},{Status:'Bounced'}])assert.equal(planLeadIntake([lead(f)],[],at).create.length,0);
 assert.equal(planLeadIntake([lead({'Source Evidence URL':'javascript:alert(1)'})],[],at).create[0].fields.Status,'BLOCKED_SOURCE_MISSING');
});
test('ambiguous duplicate snapshots require reconciliation; never silently double assign',()=>{
 assert.throws(()=>planLeadIntake([lead(),lead()],[],at),/DUPLICATE/);
 assert.throws(()=>planLeadIntake([lead()],[1,2].map(id=>({id,fields:{'Work ID':'LEAD_INTAKE:rec00000000000001'}})),at),/DUPLICATE_WORK/);
});

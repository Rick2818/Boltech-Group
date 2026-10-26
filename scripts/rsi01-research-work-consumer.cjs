#!/usr/bin/env node
// Read current BLIA/Apollo tasks. A receipt is a research review, never permission to send.
const fs=require('node:fs');
const path=require('node:path');
const qa=require('../config/qa_case.json');
function review(records){
 const receipts=[],seen=new Set();
 for(const row of records){
  const f=row.fields||{},id=f['Work ID']||'';
  if(!/^(BLIA01:|APOLLO:RSI01:|LEAD_INTAKE:)/.test(id))continue;
  if(seen.has(id))throw Error('AIRTABLE_DUPLICATE_WORK_ID');
  seen.add(id);
  if(!row.id||!f['Source Record ID'])throw Error('RESEARCH_WORK_IDENTITY_MISSING');
  const owned=/^RSI-01(?:\s|$)/.test(f.Owner||'');
  const evidence=String(f.Evidence||'');
  const isQa=f['Source Record ID']===qa.id||id.includes(qa.requestId)||evidence.includes(qa.answers[8])||evidence.includes(qa.answers[7]);
  const status=String(f.Status||'');
  const researchStatus=['RESEARCH_REQUIRED','PENDING_RSI01_RESEARCH'].includes(status);
  const blockedSource=status==='BLOCKED_SOURCE_MISSING';
  const waitingModeration=status==='WAITING_MODERATION';
  receipts.push({workId:id,recordId:row.id,sourceRecordId:f['Source Record ID'],owner:f.Owner,status:f.Status,
   result:isQa?'QA_EXCLUDED':!owned?'PRESERVED_OTHER_OWNER':waitingModeration?'PRESERVED_MODERATION':blockedSource?'BLOCKED_SOURCE_MISSING':researchStatus?'RESEARCH_REVIEW_REQUIRED':'PRESERVED_CURRENT_STAGE',
   nextAction:isQa||!owned||waitingModeration?null:blockedSource?'Locate and verify the original source; no contact until resolved.':researchStatus?'Review source and history, verify request validity, buyer identity and contact channel. Research status never authorizes outreach.':null,
   sendAllowed:false,sendPerformed:false,commercialEvidence:false});
 }
 return {actor:'RSI-01',mode:'READ_ONLY_RESEARCH_REVIEW',receipts};
}
async function consume({token,base,fetchImpl=fetch}={}){
 if(!token||!base)throw Error('AIRTABLE_AUTH_NOT_CONFIGURED');
 const records=[];let offset;const offsets=new Set();
 do{
  const query=new URLSearchParams({pageSize:'100'});if(offset)query.set('offset',offset);
  const response=await fetchImpl('https://api.airtable.com/v0/'+encodeURIComponent(base)+'/tblHVqUMifOFjlGvj?'+query,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('AIRTABLE_RESEARCH_READ_FAILED');
  const page=await response.json();if(!Array.isArray(page.records))throw Error('AIRTABLE_INVALID_RESPONSE');
  records.push(...page.records);offset=page.offset;
  if(offset){if(offsets.has(offset))throw Error('AIRTABLE_REPEATED_CURSOR');offsets.add(offset);}
 }while(offset);
 return review(records);
}
if(require.main===module)consume({token:process.env.AIRTABLE_TOKEN,base:process.env.AIRTABLE_BASE_ID}).then(result=>{
 const output=path.resolve('artifacts/blia01/rsi01-research-work-receipt.json');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify({...result,reviewedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({actor:result.actor,reviewed:result.receipts.length,sent:0}));
}).catch(error=>{console.error('RSI01_RESEARCH_CONSUMER_FAILED:',error.message);process.exitCode=1;});
module.exports={consume,review};

#!/usr/bin/env node
/**
 * Authenticated BLIA -> Airtable RSI intake. Fail closed without secrets.
 * Writes research-only rows; NEVER marks a researched article as a qualified buyer.
 * Work ID is deterministic and checked before creation.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const API='https://api.airtable.com/v0';
async function intake(handoff,{token,base,fetchImpl=fetch}={}){
 if(!token||!base)throw Error('AIRTABLE_AUTH_NOT_CONFIGURED');
 if(handoff?.consumer!=='RSI-01'||!Array.isArray(handoff.events))throw Error('INVALID_HANDOFF');
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const workTable='tblHVqUMifOFjlGvj';
 const receipts=[];
 for(const e of handoff.events){
  if(e.producer!=='BLIA-01'||e.event_type!=='LEAD_RESEARCHED'||e.synthetic!==false||e.payload?.status!=='RESEARCH_REQUIRED'||e.payload?.buyer_verified!==false||e.payload?.contact_verified!==false||!/^https:\/\//.test(e.evidence_ref)||!e.event_id)throw Error('UNSAFE_EVENT');
  const id='BLIA01:'+e.event_id;
  const formula='({Work ID}="'+id.replace(/"/g,'')+'")';
  const url=API+'/'+encodeURIComponent(base)+'/'+encodeURIComponent(workTable);
  const check=await fetchImpl(url+'?'+new URLSearchParams({filterByFormula:formula,maxRecords:'2'}),{headers});
  if(!check.ok)throw Error('AIRTABLE_READ_FAILED_'+check.status);
  const found=await check.json();
  if(!Array.isArray(found.records))throw Error('AIRTABLE_INVALID_RESPONSE');
  if(found.records.length>1)throw Error('AIRTABLE_DUPLICATE_WORK_ID');
  async function confirm(recordId){
   const readback=await fetchImpl(url+'/'+encodeURIComponent(recordId),{headers});
   if(!readback.ok)throw Error('AIRTABLE_READBACK_FAILED');
   const saved=await readback.json(),f=saved.fields||{};
   if(saved.id!==recordId||f['Work ID']!==id||f['Source Record ID']!==e.lead_id)throw Error('AIRTABLE_READBACK_MISMATCH');
   return {event_id:e.event_id,record_id:recordId,owner:f.Owner,status:f.Status,readback_verified:true};
  }
  if(found.records.length){receipts.push({...await confirm(found.records[0].id),state:'EXISTS'});continue;}
  const body={records:[{fields:{'Work ID':id,RSI:'RSI-01',Owner:'RSI-01',Status:'RESEARCH_REQUIRED','Source Record ID':e.lead_id,Evidence:JSON.stringify({url:e.evidence_ref,title:e.payload.title,market:e.payload.market,source:'BLIA-01'}),'Next Action':'Verify actual buyer, contact, purchase intent, permission, and approve content before any outreach.','Handoff To':'RSI-01',Authorization:'RESEARCH_ONLY; NO SEND','Execution State':'BLOCKED'}}]};
  const write=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body)});
  if(!write.ok)throw Error('AIRTABLE_WRITE_UNCERTAIN_'+write.status);
  const created=await write.json();
  if(!created.records?.[0]?.id)throw Error('AIRTABLE_WRITE_UNCERTAIN');
  receipts.push({...await confirm(created.records[0].id),state:'CREATED'});
 }
 return {consumer:'RSI-01',count:receipts.length,receipts};
}
if(require.main===module){
 const input=JSON.parse(fs.readFileSync(process.env.RSI_HANDOFF_FILE||'artifacts/blia01/rsi01-handoff.json','utf8'));
 intake(input,{token:process.env.AIRTABLE_TOKEN,base:process.env.AIRTABLE_BASE_ID}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error('RSI_INTAKE_FAILED',e.message);process.exitCode=1;});
}
module.exports={intake};

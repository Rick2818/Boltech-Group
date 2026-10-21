// ARCHIVED 2026-10-21: legacy RSI-01 commercial implementation, NOT approved for production execution.
#!/usr/bin/env node
/**
 * RSI-01 commercial outreach executor. Default is NO SEND.
 * Requires independently verified buyer, contact, consent/legal basis,
 * approved template, exact sender/recipient and an explicit release flag.
 * Produces reviewable outbound intents from BLIA evidence; delivery is a
 * separate, receipt-bearing Gmail integration, never a speculative claim.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
function plan(handoff, approvals={}){
 if(handoff?.consumer!=='RSI-01'||!Array.isArray(handoff.events))throw Error('Invalid RSI handoff');
 const results=[];
 for(const event of handoff.events){
  if(event.event_type!=='LEAD_RESEARCHED'||event.producer!=='BLIA-01'||event.synthetic!==false||!/^https:\/\//.test(event.evidence_ref))throw Error('Invalid research event');
  const approval=approvals[event.event_id]||{};
  const requirements=['buyer_verified','contact_verified','intent_verified','permission_verified','template_approved','recipient_verified'];
  const missing=requirements.filter(k=>approval[k]!==true);
  if(!/^\S+@\S+\.\S+$/.test(approval.recipient||''))missing.push('recipient_email');
  if(!/^\S+@\S+\.\S+$/.test(approval.sender||''))missing.push('sender_email');
  if(!approval.approved_subject||!approval.approved_body)missing.push('approved_content');
  const ready=missing.length===0;
  results.push({event_id:event.event_id,lead_id:event.lead_id,status:ready?'APPROVED_PENDING_DISPATCH':'BLOCKED_RESEARCH',missing,recipient:ready?approval.recipient:null,sender:ready?approval.sender:null,subject:ready?approval.approved_subject:null,body:ready?approval.approved_body:null,source:event.evidence_ref,send_performed:false});
 }
 return {schema_version:'1',executor:'RSI-01',mode:'PREPARE_ONLY',count:results.length,results};
}
if(require.main===module){
 try{
  const handoff=JSON.parse(fs.readFileSync(process.env.RSI_HANDOFF_FILE||'artifacts/blia01/rsi01-handoff.json','utf8'));
  const approvals=process.env.RSI_APPROVALS_FILE?JSON.parse(fs.readFileSync(process.env.RSI_APPROVALS_FILE,'utf8')):{};
  const result=plan(handoff,approvals);
  const out=path.resolve(process.env.RSI_OUTREACH_OUTPUT||'artifacts/blia01/rsi01-outreach-queue.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({executor:result.executor,blocked:result.results.filter(x=>x.status==='BLOCKED_RESEARCH').length,ready:result.results.filter(x=>x.status==='APPROVED_PENDING_DISPATCH').length,sent:0}));
 }catch(e){console.error('RSI01_EXECUTOR_FAILED:',e.message);process.exitCode=1;}
}
module.exports={plan};

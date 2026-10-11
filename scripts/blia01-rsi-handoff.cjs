#!/usr/bin/env node
/**
 * BLIA-01 -> RSI-01 research intake handoff (file-backed).
 * Produces deterministic, schema-versioned events without claiming qualified leads.
 * Actual RSI/Airtable writes require a separate authenticated consumer and receipts.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function build(input){
 if(input?.agent!=='BLIA-01'||input?.mode!=='DISCOVERY_RESEARCH_ONLY'||!Array.isArray(input.items)) throw Error('Invalid BLIA discovery envelope');
 const seen=new Set();
 const events=[];
 for(const item of input.items){
  if(item.status!=='RESEARCH_REQUIRED'||item.buyer_verified!==false||item.contact_verified!==false||item.buying_intent_verified!==false) throw Error('Unsafe candidate state');
  if(!/^[a-f0-9]{20}$/.test(item.evidence_id)||!/^https:\/\//.test(item.source_url)||!item.title||!['US','Mexico','Colombia'].includes(item.market)) throw Error('Invalid evidence record');
  if(seen.has(item.evidence_id)) continue;
  seen.add(item.evidence_id);
  events.push({schema_version:'1',event_id:crypto.createHash('sha256').update('BLIA-01:'+item.evidence_id).digest('hex'),producer:'BLIA-01',event_type:'LEAD_RESEARCHED',lead_id:'research:'+item.evidence_id,evidence_ref:item.source_url,synthetic:false,payload:{title:item.title,market:item.market,score:item.score,status:'RESEARCH_REQUIRED',buyer_verified:false,contact_verified:false,buying_intent_verified:false}});
 }
 return {schema_version:'1',consumer:'RSI-01',delivery_state:'PENDING_AUTHENTICATED_INTAKE',source_generated_at:input.generated_at,events};
}
if(require.main===module){
 try{
  const source=JSON.parse(fs.readFileSync(process.env.BLIA_OUTPUT||'artifacts/blia01/candidates.json','utf8'));
  const out=build(source);
  const destination=path.resolve(process.env.BLIA_HANDOFF_OUTPUT||'artifacts/blia01/rsi01-handoff.json');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,JSON.stringify(out,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({event_count:out.events.length,delivery_state:out.delivery_state,output:destination}));
 }catch(e){console.error('BLIA_HANDOFF_FAILED:',e.message);process.exitCode=1;}
}
module.exports={build};

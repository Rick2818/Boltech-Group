import {prepareMarketingB2BDraft} from './marketing_b2b_pipeline.js';
import {randomUUID} from 'node:crypto';

// Explicitly invoked new B2B path. Existing marketing cron stays unchanged until certified.
// This function persists reviewable material, never publishes or sends outreach.
export async function runMarketingB2BPreparedCycle({env=process.env,fetcher=fetch,research,generator,history=[],demand={},performance={}}={}){
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw Error('MARKETING_SUPABASE_CONFIGURATION_REQUIRED');
 const prepared=await prepareMarketingB2BDraft({research,generator,history,demand,performance});
 if(prepared.status!=='READY_FOR_REVIEW')return {status:prepared.status,issues:prepared.quality.issues,persisted:false,published:false};
 const id='marketing-b2b-'+randomUUID();
 const row={id,channel:'SALES_HANDOFF',workflow:prepared.item.topic,subject:prepared.item.subject,
  body:prepared.item.body,distribution_status:'REVIEW_REQUIRED',evidence:{
   strategyVersion:'marketing-b2b-v1',publicationStatus:'NOT_PUBLISHED',proof:'SOURCE_REVIEW_REQUIRED',
   industry:prepared.item.industry,buyerRole:prepared.item.buyerRole,
   businessProblem:prepared.item.businessProblem,proposedSolution:prepared.item.proposedSolution,
   sources:prepared.item.sources,kpis:prepared.item.kpis,fingerprint:prepared.quality.fingerprint
  }};
 const base=SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/marketing_content_runs';
 const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'};
 const write=await fetcher(base,{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify([row])});
 if(!write.ok)throw Error('MARKETING_B2B_WRITE_HTTP_'+write.status);
 const receipt=await fetcher(base+'?id=eq.'+encodeURIComponent(id)+'&select=id,distribution_status',{headers});
 if(!receipt.ok)throw Error('MARKETING_B2B_RECEIPT_HTTP_'+receipt.status);
 const saved=await receipt.json();
 if(!Array.isArray(saved)||saved.length!==1||saved[0].id!==id||saved[0].distribution_status!=='REVIEW_REQUIRED')
  throw Error('MARKETING_B2B_PERSISTENCE_NOT_CONFIRMED');
 return {status:'PERSISTED_FOR_REVIEW',id,persisted:true,published:false};
}

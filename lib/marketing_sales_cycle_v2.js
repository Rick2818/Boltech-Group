import {commercialSchedulerAuthorized} from './commercial_scheduler_auth.js';

// Marketing now serves actual marketplace requests, not historical cold-email leads.
// Every deliverable is linked to a verified job record and stays an internal draft.
const version='2026-10-31-marketplace-only-v3';
const briefId='boltech-marketplace-proposal-support-v3';
const safe=s=>String(s||'').replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim();
async function request(fetcher,base,headers,path,options={}){
 const r=await fetcher(base+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('MARKETING_MARKETPLACE_HTTP_'+r.status);
 const text=await r.text();return text?JSON.parse(text):null;
}
export function marketplaceProposalDraft(receipt){
 const title=safe(receipt.title).slice(0,200),need=safe(receipt.summary).slice(0,550);
 const scope=need||'the requirements described in the marketplace listing';
 const requested=safe(title+' '+scope).toLowerCase();
 const skills=[
  [/\b(n8n|make|workflow|automat|integration)\b/i,'workflow orchestration, retries and error handling'],
  [/\b(crm|hubspot|gohighlevel|salesforce)\b/i,'CRM data mappings, deduplication and validation'],
  [/\b(ai agent|chatbot|voiceflow|assistant|llm)\b/i,'agent behavior, guardrails and escalation tests'],
  [/\b(api|webhook|woocommerce|supabase)\b/i,'API/webhook authentication, logging and integration checks']
 ].filter(([re])=>re.test(requested)).map(([,label])=>label).slice(0,3);
 const focus=skills.length?skills.join('; '):'the specific workflow and acceptance criteria';
 return {
  subject:'Internal Upwork/Freelancer proposal draft — '+title,
  focus,
  body:`Hello,\n\nYour project "${title}" calls for: ${scope}\n\nBoltech Group can assess ${focus}. A sensible first milestone is to map the existing workflow and required access, agree on a bounded deliverable, implement and test that scope, then hand over the configuration and instructions.\n\nCould you clarify which systems/accounts are already available and what outcome you would use to accept the work? I would confirm scope, timeline and costs before making any commitment.\n\nBoltech Group`
 };
}
export async function runMarketingSalesCycle({env=process.env,fetcher=fetch}={}){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('MARKETING_SUPABASE_CONFIGURATION_REQUIRED');
 const base=env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY};
 const items=await request(fetcher,base,headers,
  '/agent_work?select=work_id,status,execution_receipt,updated_at&owner_agent=eq.AGENT1&work_id=like.'+encodeURIComponent('AGENT1:MARKETPLACE:%')+'&order=updated_at.desc&limit=100');
 if(!Array.isArray(items))throw Error('MARKETING_MARKETPLACE_QUEUE_INVALID');
 let prepared=0,reused=0,linked=0;const blocked=[];
 const valid=items.filter(x=>{
  const p=x?.execution_receipt;
  if(x?.status!=='PENDING'||p?.sendingEnabled!==false||p.proposalStatus!=='NOT_SUBMITTED')return false;
  if(!['UPWORK','FREELANCER'].includes(p.source))return false;
  if(!/^(UPWORK|FREELANCER)-\d{3,30}$/.test(String(p.sourceId||''))||
     x.work_id!=='AGENT1:MARKETPLACE:'+p.sourceId||
     !p.sourceId.startsWith(p.source+'-'))return false;
  try{
   const url=new URL(p.sourceUrl);
   return url.protocol==='https:'&& !url.username && !url.password &&
    url.hostname===(p.source==='UPWORK'?'www.upwork.com':'www.freelancer.com') &&
    (p.source==='UPWORK'?/^\/jobs\/~02\d{8,30}$/.test(url.pathname):/^\/projects\/[-a-z0-9_/]+$/i.test(url.pathname));
  }catch{return false;}
 });
 for(const row of valid){
  const receipt=row.execution_receipt;
  const id='marketing-platform-'+safe(receipt.sourceId);
  if(!/^marketing-platform-(UPWORK|FREELANCER)-\d{3,30}$/.test(id)){blocked.push('INVALID_WORK_ID');continue;}
  const draft=marketplaceProposalDraft(receipt);
  const asset={id,channel:'MARKETPLACE_PROPOSAL_DRAFT',workflow:'PLATFORM_BID_REVIEW',
   subject:draft.subject,body:draft.body,distribution_status:'REVIEW_REQUIRED',
   evidence:{strategyVersion:version,owner:'MARKETING',salesOwner:'AGENT1',workId:row.work_id,
    sourceId:receipt.sourceId,sourceUrl:receipt.sourceUrl,platform:receipt.source,
    opportunityTitle:receipt.title,requestedCapabilities:draft.focus,publicationStatus:'NOT_PUBLISHED',
    proposalStatus:'NOT_SUBMITTED',noCustomerCaseClaims:true,
    approvalRequired:true,proof:'LISTING_OBSERVED_NOT_CUSTOMER_ACCEPTED'}};
  const saved=await request(fetcher,base,headers,'/marketing_content_runs?on_conflict=id',{
   method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},
   body:JSON.stringify([asset])});
  if(Array.isArray(saved)&&saved.length===1&&saved[0].id===id)prepared++;else reused++;
  // Read back the durable asset before crediting a marketing handoff to Agent 1.
  const confirmed=await request(fetcher,base,headers,
    '/marketing_content_runs?id=eq.'+encodeURIComponent(id)+'&select=id,distribution_status,evidence');
  if(!Array.isArray(confirmed)||confirmed.length!==1||confirmed[0].id!==id||
    confirmed[0].distribution_status!=='REVIEW_REQUIRED'||confirmed[0].evidence?.workId!==row.work_id){
    blocked.push('MARKETING_ASSET_NOT_VERIFIED');continue;
  }
  const updatedReceipt={...receipt,marketingContentId:id,marketingStrategyVersion:version,
    marketingStatus:'DRAFT_READY_FOR_OWNER_REVIEW',proposalStatus:'NOT_SUBMITTED'};
  const acknowledged=await request(fetcher,base,headers,
    '/agent_work?work_id=eq.'+encodeURIComponent(row.work_id),{
      method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({execution_state:'MARKETING_DRAFT_READY_FOR_REVIEW',
        next_action:'Review the linked marketplace proposal draft; obtain explicit owner approval before bidding',
        execution_receipt:updatedReceipt})});
  if(Array.isArray(acknowledged)&&acknowledged.length===1&&
    acknowledged[0].execution_receipt?.marketingContentId===id)linked++;
  else blocked.push('AGENT1_MARKETING_HANDOFF_NOT_CONFIRMED');
 }
 const brief={id:briefId,strategy_version:version,segment:'Upwork and Freelancer.com job opportunities',
  message:'Prepare source-linked technical bids based on real marketplace requirements. No cold emails.',
  proof_status:'UNVERIFIED',owner:'MARKETING',sales_owner:'AGENT_1',
  status:'READY_FOR_SALES_REVIEW',source_leads:valid.length,
  evidence:{strategy:'MARKETPLACE_ONLY',sources:['UPWORK','FREELANCER'],
   supportingJobs:valid.map(x=>({workId:x.work_id,sourceUrl:x.execution_receipt.sourceUrl})),
   delivery:'INTERNAL_PROPOSAL_DRAFT_ONLY',publicationStatus:'NOT_PUBLISHED',
   autonomousSend:false,connectsSpent:0,customerOutcomeUnverified:true,
   prepared,reused,linked,ignoredNonMarketplace:items.length-valid.length,blocked}};
 await request(fetcher,base,headers,'/marketing_sales_briefs?on_conflict=id',{
  method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
  body:JSON.stringify([brief])});
 const receipt=await request(fetcher,base,headers,
  '/marketing_sales_briefs?id=eq.'+encodeURIComponent(briefId)+'&select=id,strategy_version');
 if(!Array.isArray(receipt)||receipt.length!==1||receipt[0].strategy_version!==version)throw Error('MARKETING_RECEIPT_NOT_VERIFIED');
 return {status:'MARKETPLACE_MATERIAL_PERSISTED',briefId,observed:valid.length,prepared,reused,linked,blocked,
  ignoredNonMarketplace:items.length-valid.length,publicationStatus:'NOT_PUBLISHED',proposalsSent:0,sends:0,connectsSpent:0};
}
export default async function marketingCycleHandler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!commercialSchedulerAuthorized(req))return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await runMarketingSalesCycle());}
 catch(error){return res.status(503).json({error:String(error.message).slice(0,100)});}
}

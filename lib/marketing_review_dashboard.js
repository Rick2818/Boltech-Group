import {requireMarketingSession} from './marketing_passwordless_auth.js';

// Private read-only marketing review; no service_role key is ever sent to a browser.
const TZ='America/El_Salvador';
const allowPlatform={UPWORK:'www.upwork.com',FREELANCER:'www.freelancer.com'};
function localDay(value){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
function short(value,n=4000){return String(value??'').slice(0,n);}
function listingUrl(value,source){
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&u.hostname===allowPlatform[source]&&!u.username&&!u.password?u.href:null;
 }catch{return null;}
}
async function query(fetcher,root,headers,path){
 const r=await fetcher(root+path,{method:'GET',headers,signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('MARKETING_REVIEW_DATA_UNAVAILABLE');
 const data=await r.json();
 if(!Array.isArray(data))throw Error('MARKETING_REVIEW_INVALID_DATA');
 return data;
}
export async function readMarketingReview({env=process.env,fetcher=fetch,now=new Date()}={}){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('MARKETING_REVIEW_CONFIG_MISSING');
 const root=env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,Accept:'application/json'};
 const [assets,work]=await Promise.all([
  query(fetcher,root,headers,
   '/marketing_content_runs?select=id,created_at,channel,workflow,subject,body,distribution_status,evidence'
   +'&channel=eq.MARKETPLACE_PROPOSAL_DRAFT&order=created_at.desc&limit=150'),
  query(fetcher,root,headers,
   '/agent_work?select=work_id,status,execution_state,execution_receipt'
   +'&owner_agent=eq.AGENT1&work_id=like.'+encodeURIComponent('AGENT1:MARKETPLACE:%')+'&limit=200')
 ]);
 const byId=new Map(work.map(x=>[x.work_id,x]));
 const today=localDay(now.toISOString());
 const drafts=[];
 for(const row of assets){
  if(row.distribution_status==='RETIRED_LEGACY')continue;
  const ev=row.evidence||{},platform=ev.platform,workId=ev.workId;
  if(!['UPWORK','FREELANCER'].includes(platform)||!/^AGENT1:MARKETPLACE:(UPWORK|FREELANCER)-\d{3,30}$/.test(workId||''))continue;
  if(workId!=='AGENT1:MARKETPLACE:'+ev.sourceId)continue;
  const sourceUrl=listingUrl(ev.sourceUrl,platform);
  if(!sourceUrl)continue;
  const match=byId.get(workId);
  const linked=match?.execution_receipt?.marketingContentId===row.id&&
               match?.execution_receipt?.sourceId===ev.sourceId;
  const createdAt=String(row.created_at||'');
  if(!Number.isFinite(Date.parse(createdAt)))continue;
  drafts.push({
   id:short(row.id,140),workId:short(workId,140),platform,sourceUrl,
   title:short(ev.opportunityTitle||row.subject,260),subject:short(row.subject,280),
   body:short(row.body,8000),createdAt,day:localDay(createdAt),
   status:short(row.distribution_status,60),proposalStatus:short(match?.execution_receipt?.proposalStatus||ev.proposalStatus||'UNVERIFIED',60),
   linked,publicationStatus:short(ev.publicationStatus||'UNVERIFIED',50),
   requestedCapabilities:short(ev.requestedCapabilities,600)
  });
 }
 const latest=drafts[0]?.createdAt||null;
 const byPlatform={UPWORK:drafts.filter(d=>d.platform==='UPWORK').length,FREELANCER:drafts.filter(d=>d.platform==='FREELANCER').length};
 return {status:'READ_ONLY',strategy:'UPWORK_FREELANCER_ONLY',timezone:TZ,localDay:today,checkedAt:now.toISOString(),
  lastMaterialAt:latest,
  metrics:{total:drafts.length,createdToday:drafts.filter(d=>d.day===today).length,
   pendingReview:drafts.filter(d=>d.status==='REVIEW_REQUIRED').length,
   handoffsVerified:drafts.filter(d=>d.linked).length,
   proposalsVerifiedSent:0, // No provider bid receipt is retrieved by this dashboard.
   sentMetricAvailable:false,byPlatform},
  drafts,publicationMetricAvailable:false,sendEnabled:false,connectsSpendEnabled:false};
}
export async function handleMarketingReview(req,res,{env=process.env,fetcher=fetch,now=new Date(),redis}={}){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!await requireMarketingSession(req,res,{redis}))return;
 try{return res.status(200).json(await readMarketingReview({env,fetcher,now}));}
 catch(e){return res.status(503).json({error:/^MARKETING_REVIEW_[A-Z_]+$/.test(e.message)?e.message:'MARKETING_REVIEW_UNAVAILABLE'});}
}

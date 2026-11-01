// Official Freelancer.com read-only project search (OAuth token required).
// Never submit bids/messages or infer that a project is still eligible.
const queries=['n8n','AI agent','automation','Supabase','CRM integration','chatbot'];
const relevant=/\b(n8n|automation|workflow|ai agent|chatbot|supabase|crm|api|integration)\b/i;
const clean=x=>String(x||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export async function discoverFreelancerJobs({env=process.env,now=new Date().toISOString(),limit=30,fetcher=fetch}={}){
 const token=String(env.FREELANCER_OAUTH_TOKEN||'').trim();
 if(!token)return {source:'FREELANCER',status:'NOT_CONNECTED',code:'FREELANCER_OAUTH_REQUIRED',found:[]};
 const found=[],seen=new Set(),errors=[];
 for(const query of queries){
  if(found.length>=limit)break;
  const url=new URL('https://www.freelancer.com/api/projects/0.1/projects/active/');
  url.searchParams.set('query',query);url.searchParams.set('limit','10');url.searchParams.set('offset','0');
  try{
   const r=await fetcher(url.href,{headers:{'Freelancer-OAuth-V1':token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
   if(!r.ok){errors.push('FREELANCER_HTTP_'+r.status);if(r.status===401||r.status===403)break;continue;}
   const data=await r.json();
   const projects=data?.result?.projects;
   if(!Array.isArray(projects)){errors.push('FREELANCER_RESPONSE_INVALID');continue;}
   for(const p of projects){
    const id=String(p.id||''),title=clean(p.title).slice(0,200);
    const summary=clean(p.description||p.preview_description).slice(0,900);
    const seo=String(p.seo_url||'');
    if(!/^\d{3,30}$/.test(id)||seen.has(id)||!relevant.test(title+' '+summary)||!/^[-a-zA-Z0-9_/]{3,250}$/.test(seo))continue;
    const seconds=Number(p.time_submitted||p.time_updated||0);
    const publishedAt=new Date(seconds*1000);
    const age=Date.parse(now)-publishedAt.getTime();
    if(!Number.isFinite(age)||age<0||age>30*86400000)continue;
    found.push({source:'FREELANCER',sourceId:'FREELANCER-'+id,title,
      sourceUrl:'https://www.freelancer.com/projects/'+seo.replace(/^projects\//,''),
      publishedAt:publishedAt.toISOString(),observedAt:now,requestSummary:summary,
      contactChannel:'FREELANCER_BID',sendingEnabled:false,
      marketplace:{bidCount:p.bid_stats?.bid_count??null,budgetMinimum:p.budget?.minimum??null,budgetMaximum:p.budget?.maximum??null,currency:p.currency?.code??null,paymentVerified:p.owner?.payment_verified??null}});
    seen.add(id);if(found.length>=limit)break;
   }
  }catch{errors.push('FREELANCER_REQUEST_FAILED');}
 }
 return {source:'FREELANCER',status:errors.length&&!found.length?'BLOCKED':'OBSERVED',code:errors[0]||null,found,errors};
}

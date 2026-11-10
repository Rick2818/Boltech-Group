// Private, owner-initiated reads only. No bidding, messaging or campaigns.
const integrationJSON = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const integrationText = value => typeof value==='string' ? value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,500) : '';
function integrationAuthorized(request,env) {
  const expected=String(env.LEO_PLATFORM_TOKEN||'');
  const supplied=request.headers.get('Authorization')||'';
  if(expected.length<24 || supplied.length!==expected.length+7) return false;
  const target='Bearer '+expected; let difference=0;
  for(let i=0;i<target.length;i++) difference|=supplied.charCodeAt(i)^target.charCodeAt(i);
  return difference===0;
}
async function integrationProvider(url,options) {
  const response=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw Error('PROVIDER_HTTP_'+response.status);
  const data=await response.json();
  if(!data || data.status==='error' || data.success===false) throw Error('PROVIDER_REJECTED');
  return data;
}
export async function handleLeoIntegrations(request,env) {
  if(request.method!=='POST') return integrationJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
  if(!env.LEO_PLATFORM_TOKEN || String(env.LEO_PLATFORM_TOKEN).length<24) return integrationJSON({success:false,error:'OWNER_ACCESS_NOT_CONFIGURED'},503);
  if(!integrationAuthorized(request,env)) return integrationJSON({success:false,error:'OWNER_ACCESS_REQUIRED'},401);
  const origin=request.headers.get('Origin');
  if(origin && origin!==new URL(request.url).origin) return integrationJSON({success:false,error:'ORIGIN_NOT_ALLOWED'},403);
  let input;
  try { const raw=await request.text(); if(raw.length>4000) throw Error(); input=JSON.parse(raw); }
  catch { return integrationJSON({success:false,error:'INVALID_REQUEST'},400); }
  if(!input || !['status','check','search'].includes(input.action)) return integrationJSON({success:false,error:'INVALID_ACTION'},400);
  if(input.action==='status') return integrationJSON({success:true,verified:false,mode:'PRIVATE_READ_ONLY',
    freelancer:{configured:!!env.FREELANCER_OAUTH_TOKEN,enabled:env.FREELANCER_API_ENABLED==='true'},
    explee:{configured:!!env.EXPLEE_API_KEY},externalActions:[]});
  const platform=input.platform;
  if(!['freelancer','explee'].includes(platform)) return integrationJSON({success:false,error:'INVALID_PLATFORM'},400);
  const key=platform==='freelancer'?env.FREELANCER_OAUTH_TOKEN:env.EXPLEE_API_KEY;
  if(!key) return integrationJSON({success:false,error:'PROVIDER_SECRET_MISSING',platform},503);
  if(platform==='freelancer' && env.FREELANCER_API_ENABLED!=='true') return integrationJSON({success:false,error:'FREELANCER_API_DISABLED',platform},409);
  const headers=platform==='freelancer'?{'Freelancer-OAuth-V1':key,Accept:'application/json'}:{'X-API-Key':key,'Content-Type':'application/json'};
  let activeReceipt=null;
  try {
    if(input.action==='check') {
      const data=platform==='freelancer'
        ? await integrationProvider('https://www.freelancer.com/api/users/0.1/self/',{headers})
        : await integrationProvider('https://api.explee.com/public/api/v1/search/nl-to-filters',{method:'POST',headers,body:JSON.stringify({query:'Business workflow automation companies'})});
      if(platform==='freelancer' && !data.result?.id) throw Error('PROVIDER_RESPONSE_INVALID');
      if(platform==='explee' && (!data.companies_filters || typeof data.companies_filters!=='object')) throw Error('PROVIDER_RESPONSE_INVALID');
      return integrationJSON({success:true,platform,status:'CONNECTED',checkedAt:new Date().toISOString(),mode:'READ_ONLY'});
    }
    const query=integrationText(input.query);
    if(query.length<3 || query.length>300) return integrationJSON({success:false,error:'INVALID_QUERY'},400);
    // Persist a receipt before the provider call. A failed ledger blocks searches.
    if(!env.COMMERCE?.put) return integrationJSON({success:false,error:'RECEIPT_STORE_UNAVAILABLE'},503);
    const id=crypto.randomUUID(); const receiptKey='leo:integration-read:'+id;
    const receipt={id,platform,query,startedAt:new Date().toISOString(),status:'STARTED',mode:'READ_ONLY'};
    await env.COMMERCE.put(receiptKey,JSON.stringify(receipt),{expirationTtl:2592000});
    activeReceipt={key:receiptKey,value:receipt};
    let items,meta;
    if(platform==='freelancer') {
      const url=new URL('https://www.freelancer.com/api/projects/0.1/projects/active/');
      url.searchParams.set('query',query); url.searchParams.set('limit','10');
      const data=await integrationProvider(url.href,{headers});
      if(!Array.isArray(data.result?.projects)) throw Error('PROVIDER_RESPONSE_INVALID');
      items=data.result.projects.slice(0,10).map(p=>({id:String(p.id||''),title:integrationText(p.title),
        url:/^[-a-zA-Z0-9_/]{3,250}$/.test(p.seo_url||'')?'https://www.freelancer.com/projects/'+p.seo_url.replace(/^projects\//,''):null,
        budget:p.budget?{minimum:p.budget.minimum,maximum:p.budget.maximum,currency:p.currency?.code}:null}));
    } else {
      // Fixed first page, at most ten companies, no enrichment/dedup/paid pagination.
      // Provider docs: this request is within the free result zone; never retry 402/429.
      const data=await integrationProvider('https://api.explee.com/public/api/v1/search/companies',{
        method:'POST',headers,body:JSON.stringify({filters:{definition:query},page:1,page_size:10})});
      if(!Array.isArray(data.companies)||!data.meta) throw Error('PROVIDER_RESPONSE_INVALID');
      meta={creditsCharged:data.meta.credits_charged};
      items=data.companies.slice(0,10).map(c=>({title:integrationText(c.name),domain:integrationText(c.domain),description:integrationText(c.description)}));
    }
    await env.COMMERCE.put(receiptKey,JSON.stringify({...receipt,status:'COMPLETED',completedAt:new Date().toISOString(),count:items.length,meta}),{expirationTtl:2592000});
    return integrationJSON({success:true,platform,items,meta,receiptId:id,mode:'READ_ONLY',authorizedActions:[]});
  } catch(error) {
    const code=/^(PROVIDER_HTTP_\d{3}|PROVIDER_REJECTED|PROVIDER_RESPONSE_INVALID)$/.test(error.message)?error.message:'INTEGRATION_REQUEST_FAILED';
    if(activeReceipt) try {await env.COMMERCE.put(activeReceipt.key,JSON.stringify({...activeReceipt.value,status:'FAILED',error:code,completedAt:new Date().toISOString()}),{expirationTtl:2592000});} catch {}
    return integrationJSON({success:false,platform,error:code},502);
  }
}

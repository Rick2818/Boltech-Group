// Evidence intake gate: inspect actual HTTPS source response before marketing generation.
// External URL fetch is deliberately limited to an explicit, reviewed hostname allowlist.
const isPublicHost=host=>host!=='localhost'&&!host.endsWith('.localhost')&&!host.endsWith('.local')&&
 !/^\d+(?:\.\d+){3}$/.test(host)&&!host.includes(':')&&host.includes('.');
export async function verifyMarketingResearch({candidates=[],allowedHosts=[],fetcher=fetch,now=new Date()}={}){
 if(!Array.isArray(allowedHosts)||!allowedHosts.length)throw Error('MARKETING_RESEARCH_ALLOWLIST_REQUIRED');
 const hosts=new Set(allowedHosts.map(h=>String(h).toLowerCase()));
 const verified=[];
 for(const item of candidates.slice(0,12)){
  let url;try{url=new URL(item?.url)}catch{continue}
  if(url.protocol!=='https:'||url.username||url.password||!isPublicHost(url.hostname)||!hosts.has(url.hostname.toLowerCase()))continue;
  try{
   const response=await fetcher(url.toString(),{method:'GET',redirect:'error',headers:{Accept:'text/html, text/plain, application/json'},signal:AbortSignal.timeout(8000)});
   if(!response.ok)continue;
   const type=String(response.headers?.get?.('content-type')||'');
   if(!/text\/html|text\/plain|application\/json/i.test(type))continue;
   const body=await response.text();
   if(body.length<150||body.length>250000)continue;
   const title=String(item.title||'').trim().slice(0,240);
   if(!title)continue;
   verified.push({url:url.toString(),title,observedAt:now.toISOString(),httpStatus:response.status,
    excerpt:body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,1200)});
  }catch{/* blocked, unavailable or redirected source is not evidence */}
 }
 return verified;
}

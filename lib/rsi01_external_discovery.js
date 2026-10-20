// External public signal discovery, not validated business leads or outbound consent.
// Source: Hacker News Algolia search API, anonymous HTTPS and public discussion only.
import {createAgent1SalesExecutor} from './agent1_sales_skills.js';
// Only expressed requests for operational help. Mentions of AI/automation are not buyer intent.
const demand=/\b(?:looking for|need(?:ing)?|seeking|can anyone recommend|recommendations for|how (?:can|do) (?:we|i))\b/i;
const businessProcess=/\b(?:workflow|business|customer support|customer service|sales|crm|quot(?:e|ing|ation)|invoice|manual data entry|data processing|operations|lead management|automation|integrat(?:e|ion))\b/i;
const exclude=/^(?:show hn|launch hn|ask hn: who is hiring|who is hiring)|\b(?:looking for (?:a |an )?(?:remote |new )?(?:job|role|position)|job search|hiring|resume|cv|i (?:built|made|created|launched)|my (?:project|startup|tool|product|app)|open.source release)\b/i;
export function extractPublicSignals(payload,{existing=new Set(),cutoff=0,limit=5}={}){
 const found=[];
 for(const h of payload?.hits||[]){
  const id=String(h.objectID||'');
  const title=String(h.title||h.story_title||'').replace(/<[^>]*>/g,' ').trim();
  const stamp=Number(h.created_at_i||0);
  if(!/^\d{5,15}$/.test(id)||existing.has(id)||stamp<cutoff||!demand.test(title)||!businessProcess.test(title)||exclude.test(title)||title.length<18)continue;
  found.push({sourceId:id,sourceUrl:`https://news.ycombinator.com/item?id=${id}`,title:title.slice(0,240),publishedAt:new Date(stamp*1000).toISOString(),state:'UNVERIFIED_PUBLIC_DEMAND_SIGNAL',buyerVerified:false,contactEligible:false});
  existing.add(id);if(found.length>=limit)break;
 }
 return found;
}
export async function discoverExternalSignals({fetcher=fetch,now=()=>new Date().toISOString(),existing=new Set(),limit=5}={}){
 const found=[],errors=[];
 const cutoff=Math.floor(Date.parse(now())/1000)-45*86400;
 const searchPlan=createAgent1SalesExecutor().planSearch();
 for(const query of searchPlan.queries){
  if(found.length>=limit)break;
  const url=new URL('https://hn.algolia.com/api/v1/search_by_date');
  url.searchParams.set('query',query);url.searchParams.set('tags','story');
  url.searchParams.set('numericFilters',`created_at_i>${cutoff}`);url.searchParams.set('hitsPerPage','30');
  try{
   const response=await fetcher(url.toString(),{method:'GET',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Error('SOURCE_HTTP_ERROR');
   const data=await response.json();
   const batch=extractPublicSignals(data,{existing,cutoff,limit:limit-found.length});
   found.push(...batch);
  }catch{errors.push('PUBLIC_SOURCE_UNAVAILABLE');}
 }
 return {source:'HACKER_NEWS_PUBLIC_SEARCH',skills:searchPlan,found,sourceErrors:errors,qualifiedBusinessLeads:0,sendingEnabled:false};
}

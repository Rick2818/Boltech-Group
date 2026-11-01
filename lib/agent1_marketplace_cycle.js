import {commercialSchedulerAuthorized} from './commercial_scheduler_auth.js';
import {discoverUpworkJobs} from './rsi01_platform_sources.js';
import {discoverFreelancerJobs} from './freelancer_project_source.js';

// Single read-only marketplace engine. No Gmail, cold outreach, bidding or paid operations.
const allowedHosts={UPWORK:'www.upwork.com',FREELANCER:'www.freelancer.com'};
const fit=/\b(n8n|automation|automations|automatizaci[oó]n|workflow|ai agent|ai agents|agentes? (?:de )?ia|chatbot|supabase|crm|api integration|api integrations|integraci[oó]n|voiceflow|make\.com)\b/i;
function trusted(item,now){
 if(!item || !['UPWORK','FREELANCER'].includes(item.source))return false;
 if(!/^(UPWORK|FREELANCER)-[0-9]{3,30}$/.test(String(item.sourceId||'')))return false;
 try{const u=new URL(item.sourceUrl);if(u.protocol!=='https:'||u.hostname!==allowedHosts[item.source]||u.username||u.password)return false;}catch{return false;}
 const age=now.getTime()-Date.parse(item.publishedAt||'');
 return age>=0&&age<=30*86400000&&fit.test(String(item.title||'')+' '+String(item.requestSummary||''))&&item.sendingEnabled===false;
}
async function rest(fetcher,root,headers,path,init={}){
 const response=await fetcher(root+path,{...init,headers:{...headers,...init.headers},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('MARKETPLACE_STORE_HTTP_'+response.status);
 const text=await response.text();return text?JSON.parse(text):null;
}
export async function runAgent1MarketplaceCycle({env=process.env,fetcher=fetch,now=new Date(),upwork=discoverUpworkJobs,freelancer=discoverFreelancerJobs}={}){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('MARKETPLACE_SUPABASE_CONFIG_REQUIRED');
 const root=env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY};
 const sources=await Promise.allSettled([
   upwork({env,now:now.toISOString(),limit:30}),
   freelancer({env,now:now.toISOString(),limit:30,fetcher})
 ]);
 const report={status:'MARKETPLACE_RESEARCH_ONLY',strategy:'UPWORK_FREELANCER_ONLY',sources:[],observed:0,newOpportunities:0,duplicateOrPending:0,errors:[],outreachSent:0,proposalsSent:0,connectsSpent:0,sendingEnabled:false};
 for(let i=0;i<sources.length;i++){
  const sourceName=i===0?'UPWORK':'FREELANCER';
  const result=sources[i].status==='fulfilled'?sources[i].value:{status:'BLOCKED',code:'MARKETPLACE_SOURCE_FAILED',found:[]};
  report.sources.push({source:sourceName,status:result.status||'BLOCKED',code:result.code||null,observed:Array.isArray(result.found)?result.found.length:0});
  for(const item of Array.isArray(result.found)?result.found:[]){
   if(!trusted(item,now)){report.errors.push({source:sourceName,code:'UNVERIFIED_PLATFORM_LISTING'});continue;}
   report.observed++;
   const workId='AGENT1:MARKETPLACE:'+item.sourceId;
   const row={work_id:workId,owner_agent:'AGENT1',status:'PENDING',execution_state:'MARKETPLACE_OPPORTUNITY_REVIEW',
     authorization_note:'Read-only platform research; bids/messages/Connects require explicit owner approval',
     evidence:item.sourceUrl,next_action:'Review job scope, budget, competition, platform eligibility and draft proposal before any approval',
     execution_receipt:{source:item.source,sourceId:item.sourceId,title:item.title,sourceUrl:item.sourceUrl,
       publishedAt:item.publishedAt,observedAt:now.toISOString(),summary:item.requestSummary,
       contactChannel:item.contactChannel,marketplace:item.marketplace||{},proposalStatus:'NOT_SUBMITTED',
       marketingContentId:null,sendingEnabled:false,connectsSpent:0}};
   try{
    const saved=await rest(fetcher,root,headers,'/agent_work?on_conflict=work_id',{
      method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},
      body:JSON.stringify([row])});
    if(Array.isArray(saved)&&saved.length===1&&saved[0].work_id===workId)report.newOpportunities++;
    else report.duplicateOrPending++;
   }catch(error){report.errors.push({source:sourceName,code:String(error.message).slice(0,80)});}
  }
 }
 report.operationalReadiness=report.sources.some(s=>s.status==='OBSERVED')?'PARTIAL_OR_READY':'BLOCKED_PLATFORM_AUTH';
 report.authorizationRequired=report.sources.filter(s=>s.status==='BLOCKED'||s.status==='NOT_CONNECTED').map(s=>({platform:s.source,code:s.code||'SOURCE_UNAVAILABLE'}));
 report.allPlatformsConnected=report.sources.every(s=>s.status==='OBSERVED');
 return report;
}
export default async function marketplaceCycleHandler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!commercialSchedulerAuthorized(req))return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await runAgent1MarketplaceCycle());}
 catch(error){return res.status(503).json({error:String(error.message).slice(0,100)});}
}

import {commercialSchedulerAuthorized} from './commercial_scheduler_auth.js';
import {MARKETING_PLAYBOOK} from './marketing_commercial_playbook.js';
import {positioningForMarketing,positioningForSales,BOLTECH_POSITIONING} from './boltech_positioning_v2.js';
const pid='managed-ai-operations-v2-us-b2b';
async function request(fetcher,url,options,label){const r=await fetcher(url,options);if(!r.ok)throw Error(label+'_HTTP_'+r.status);const t=await r.text();return t?JSON.parse(t):null;}
export async function runMarketingSalesCycle({env=process.env,fetcher=fetch}={}){
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw Error('MARKETING_MISSING_SUPABASE_CONFIGURATION');
 if([...SUPABASE_SERVICE_ROLE_KEY].some(c=>c.codePointAt(0)>255))throw Error('MARKETING_INVALID_SERVICE_KEY_FORMAT');
 const base=SUPABASE_URL.replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY};
 const rows=await request(fetcher,base+'/leads?select=id,country,commercial_stage,problem_confirmed,source_evidence_url,data_quality,status&limit=1000',{headers},'MARKETING_LEADS_READ');
 if(!Array.isArray(rows))throw Error('MARKETING_LEADS_INVALID');
 const us=rows.filter(x=>/^(US|USA|United States)$/i.test(String(x.country||''))&&!/synthetic|qa|test/i.test(String(x.data_quality||'')));
 // Rotate by El Salvador calendar day, not UTC hour. Adjacent days must
 // choose different playbook entries while reruns on the same day reuse the ID.
 const day=new Date(Date.now()-6*3600000).toISOString().slice(0,10);
 const dayNumber=Math.floor(Date.parse(day+'T00:00:00Z')/86400000);
 const index=((dayNumber%MARKETING_PLAYBOOK.problemMessages.length)+MARKETING_PLAYBOOK.problemMessages.length)%MARKETING_PLAYBOOK.problemMessages.length;
 const chosen=MARKETING_PLAYBOOK.problemMessages[index];
 const contentId='marketing-'+day+'-'+chosen.key.toLowerCase();
 const body=[chosen.subject,chosen.pain+'.',chosen.solution+'.',chosen.cta].join('\\n\\n');
 const assetRun={id:contentId,channel:'SALES_HANDOFF',workflow:chosen.key,subject:chosen.subject,body,distribution_status:'SALES_QUEUE_READY',evidence:{playbookVersion:MARKETING_PLAYBOOK.version,publicationStatus:'NOT_PUBLISHED',proof:'UNVERIFIED',audience:chosen.audience,campaignDay:day}};
 await request(fetcher,base+'/marketing_content_runs?on_conflict=id',{method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([assetRun])},'MARKETING_CONTENT_WRITE');
 const confirmed=await request(fetcher,base+'/marketing_content_runs?id=eq.'+encodeURIComponent(contentId)+'&select=id,distribution_status',{headers},'MARKETING_CONTENT_RECEIPT');
 if(!Array.isArray(confirmed)||confirmed.length!==1)throw Error('MARKETING_CONTENT_NOT_PERSISTED');
 const message=positioningForMarketing();
 const sales=positioningForSales();
 const brief={id:pid,strategy_version:MARKETING_PLAYBOOK.version,segment:'US B2B businesses with repetitive workflows',message:message.message,proof_status:'UNVERIFIED',owner:'MARKETING',sales_owner:'AGENT_1',status:'READY_FOR_SALES_REVIEW',source_leads:us.length,evidence:{checked_leads:rows.length,us_leads:us.length,confirmed_needs:us.filter(x=>x.problem_confirmed===true).length,positioning:message.angles,playbookVersion:MARKETING_PLAYBOOK.version,assets:MARKETING_PLAYBOOK.problemMessages.map(p=>({id:'marketing-'+p.key.toLowerCase(),...p,proof:'UNVERIFIED',publicationStatus:'DRAFT_ONLY'})),demonstrations:MARKETING_PLAYBOOK.demonstrations,measurement:MARKETING_PLAYBOOK.measurement,sales_message:sales.message,claims_not_certified:true,autonomous_send:false}};
 await request(fetcher,base+'/marketing_sales_briefs?on_conflict=id',{method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([brief])},'MARKETING_BRIEF_WRITE');
 const saved=await request(fetcher,base+'/marketing_sales_briefs?id=eq.'+encodeURIComponent(pid)+'&select=id,status,source_leads,strategy_version',{headers},'MARKETING_RECEIPT');
 if(!Array.isArray(saved)||saved.length!==1||saved[0].strategy_version!==MARKETING_PLAYBOOK.version)throw Error('MARKETING_BRIEF_NOT_PERSISTED');
 return {status:'PERSISTED_FOR_SALES_REVIEW',briefId:pid,contentId,distribution:'SALES_QUEUE_READY',sourceLeads:us.length,salesMessageAvailable:true,send:false};
}
export default async function marketingCycleHandler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!commercialSchedulerAuthorized(req))return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await runMarketingSalesCycle())}catch(err){return res.status(503).json({error:String(err.message).slice(0,120)})}
}

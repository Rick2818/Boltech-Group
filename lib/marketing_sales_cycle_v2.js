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
 const message=positioningForMarketing();
 const sales=positioningForSales();
 const brief={id:pid,strategy_version:MARKETING_PLAYBOOK.version,segment:'US B2B businesses with repetitive workflows',message:message.message,proof_status:'UNVERIFIED',owner:'MARKETING',sales_owner:'AGENT_1',status:'READY_FOR_SALES_REVIEW',source_leads:us.length,evidence:{checked_leads:rows.length,us_leads:us.length,confirmed_needs:us.filter(x=>x.problem_confirmed===true).length,positioning:message.angles,playbookVersion:MARKETING_PLAYBOOK.version,assets:MARKETING_PLAYBOOK.problemMessages.map(p=>({id:'marketing-'+p.key.toLowerCase(),...p,proof:'UNVERIFIED',publicationStatus:'DRAFT_ONLY'})),demonstrations:MARKETING_PLAYBOOK.demonstrations,measurement:MARKETING_PLAYBOOK.measurement,sales_message:sales.message,claims_not_certified:true,autonomous_send:false}};
 await request(fetcher,base+'/marketing_sales_briefs?on_conflict=id',{method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([brief])},'MARKETING_BRIEF_WRITE');
 const saved=await request(fetcher,base+'/marketing_sales_briefs?id=eq.'+encodeURIComponent(pid)+'&select=id,status,source_leads,strategy_version',{headers},'MARKETING_RECEIPT');
 if(!Array.isArray(saved)||saved.length!==1||saved[0].strategy_version!==MARKETING_PLAYBOOK.version)throw Error('MARKETING_BRIEF_NOT_PERSISTED');
 return {status:'PERSISTED_FOR_SALES_REVIEW',briefId:pid,sourceLeads:us.length,salesMessageAvailable:true,send:false};
}
export default async function marketingCycleHandler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await runMarketingSalesCycle())}catch(err){return res.status(503).json({error:String(err.message).slice(0,120)})}
}

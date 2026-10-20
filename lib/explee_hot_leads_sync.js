// Read-only Explee hot leads -> Supabase. No outreach, paid searches or CRM status promotion.
const projectId=51973;
const j=async(r,where)=>{if(!r.ok)throw Error(where+'_HTTP_'+r.status);return r.status===204?null:(await r.text().then(t=>t?JSON.parse(t):null))};
export async function syncHotLeads({env=process.env,fetcher=fetch}={}){
 const {EXPLEE_API_KEY,SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=env;
 if(!EXPLEE_API_KEY||!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw Error('EXPLEE_SYNC_SECRETS_MISSING');
 for (const [name,value] of Object.entries({EXPLEE_API_KEY,SUPABASE_SERVICE_ROLE_KEY})) {
  if ([...value].some(ch=>ch.codePointAt(0)>255)) throw Error(name+'_NON_LATIN1_CHARACTER');
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(SUPABASE_URL)) throw Error('SUPABASE_URL_INVALID_FORMAT');
const root=SUPABASE_URL.replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY};
 const base=root+'/explee_hot_leads_cursor?project_id=eq.'+projectId+'&select=newest_hot_at';
 const cursorRows=await j(await fetcher(base,{headers}), 'CURSOR_READ');
 const since=cursorRows[0]?.newest_hot_at||'1970-01-01T00:00:00Z';
 const campaigns=await j(await fetcher('https://api.explee.com/public/api/v1/autogtm/campaigns?project_id='+projectId,{headers:{'X-API-Key':EXPLEE_API_KEY}}),'EXPLEE_CAMPAIGNS');
 if(!Array.isArray(campaigns.campaigns))throw Error('EXPLEE_CAMPAIGNS_SHAPE');
 const allowedCampaignIds=new Set(campaigns.campaigns.map(x=>String(x.id)));
 let items=[],offset=0;
 while(true){
  const url=new URL('https://api.explee.com/public/api/v1/autogtm/hot-leads');
  url.searchParams.set('since',since);url.searchParams.set('limit','200');url.searchParams.set('offset',String(offset));
  const reply=await j(await fetcher(url,{headers:{'X-API-Key':EXPLEE_API_KEY}}),'EXPLEE_READ');
  if(!Array.isArray(reply.leads))throw Error('EXPLEE_UNEXPECTED_RESPONSE_SHAPE');
  items.push(...reply.leads);
  if(!reply.has_more)break;
  offset=reply.next_offset??(offset+reply.leads.length);
  if(offset>=10000)throw Error('EXPLEE_SYNC_PAGE_CAP_REACHED_NO_CURSOR_ADVANCE');
 }
 const ready=items.filter(x=>allowedCampaignIds.has(String(x.campaign_id)));
 if(ready.length!==items.length)throw Error('EXPLEE_OTHER_PROJECT_LEADS_PRESENT_REQUIRES_SCOPE');
 const records=ready.map(x=>({
  project_id:projectId,campaign_id:String(x.campaign_id||''),person_id:String(x.person_id||''),
  name:x.name||null,email:x.email||null,job_title:x.job_title||null,company_name:x.company_name||null,
  company_domain:x.company_domain||null,linkedin_url:x.linkedin_url||null,country:x.country||null,
  phone:x.phone||null,why_hot:x.why_hot||null,became_hot_at:x.became_hot_at
 }));
 if(records.some(x=>!x.person_id||!x.campaign_id||!x.became_hot_at||Number.isNaN(Date.parse(x.became_hot_at))))throw Error('EXPLEE_INVALID_LEAD_INCOMPLETE');
 for(let i=0;i<records.length;i+=100){
  await j(await fetcher(root+'/explee_hot_leads?on_conflict=project_id,campaign_id,person_id',{
   method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
   body:JSON.stringify(records.slice(i,i+100))
  }),'SUPABASE_UPSERT');
 }
 if(records.length){
  const newest=records.map(x=>x.became_hot_at).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  if(Date.parse(newest)>Date.parse(since)){
   await j(await fetcher(root+'/explee_hot_leads_cursor?on_conflict=project_id',{
    method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify([{project_id:projectId,newest_hot_at:newest}])
   }),'CURSOR_WRITE');
  }
 }
 return {status:'OK',fetched:records.length,projectId,cursorBefore:since};
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await syncHotLeads())}catch(e){return res.status(503).json({error:String(e.message).slice(0,110)})}
}

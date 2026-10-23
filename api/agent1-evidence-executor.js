import { createClient } from '@supabase/supabase-js';
export default async function handler(req,res) {
 if(req.method!=='POST') return res.status(405).json({error:'METHOD'});
 const secret=process.env.BOLTECH_SCHEDULER_SECRET;
 if(!secret||secret.length<32||req.headers.authorization!=='Bearer '+secret) return res.status(401).json({error:'AUTH'});
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) return res.status(503).json({error:'CONFIG'});
 const db=createClient(url,key);
 const {data,error}=await db.from('leads').select('id,company_url,source_payload').eq('commercial_stage','DRAFT_REVIEW').limit(3);
 if(error) return res.status(502).json({error:'READ'});
 const output=[];
 for(const lead of data||[]) {
  const buyer=lead.source_payload?.research?.contactName;
  let u;
  try {u=new URL(lead.company_url); if(u.protocol!=='https:') throw Error();} catch {output.push({id:lead.id,status:'INVALID_URL'});continue;}
  if(!buyer){output.push({id:lead.id,status:'BUYER_MISSING'});continue;}
  try {
   const r=await fetch(u.toString(),{signal:AbortSignal.timeout(6000),redirect:'error'});
   if(!r.ok||!(r.headers.get('content-type')||'').includes('text/html')) throw Error();
   const html=(await r.text()).slice(0,300000);
   const plain=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
   const idx=plain.toLowerCase().indexOf(buyer.toLowerCase());
   const excerpt=idx>=0?plain.slice(Math.max(0,idx-120),idx+buyer.length+180):'';
   const domain=u.hostname.replace(/^www\./,'').toLowerCase();
   const emails=(excerpt.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/ig)||[]).filter(x=>x.split('@')[1].toLowerCase()===domain);
   const evidence={checkedAt:new Date().toISOString(),sourceUrl:u.toString(),excerpt:excerpt.slice(0,320),candidateEmails:emails,status:emails.length?'MANUAL_PROOF_REVIEW':'NO_DIRECT_PROOF'};
   const {error:writeError}=await db.from('leads').update({source_payload:{...lead.source_payload,evidenceExecutor:evidence}}).eq('id',lead.id).eq('commercial_stage','DRAFT_REVIEW');
   output.push({id:lead.id,status:writeError?'WRITE_FAILED':evidence.status});
  }catch {output.push({id:lead.id,status:'SOURCE_UNAVAILABLE'});}
 }
 return res.status(200).json({processed:output.length,results:output});
}

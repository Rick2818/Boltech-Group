// Observational sales work loop: never invent replies, execute outreach, or record a sale without provider receipts.
export async function runAgent1Cycle({env=process.env,fetcher=fetch,now=new Date()}={}){
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw Error('SALES_CYCLE_CONFIGURATION_MISSING');
 if([...SUPABASE_SERVICE_ROLE_KEY].some(x=>x.codePointAt(0)>255))throw Error('SUPABASE_SERVICE_ROLE_KEY_INVALID_CHARACTERS');
 const root=SUPABASE_URL.replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY};
 async function call(path,options={}){const r=await fetcher(root+path,{...options,headers:{...headers,...options.headers}});if(!r.ok)throw Error('SALES_CYCLE_HTTP_'+r.status);const t=await r.text();return t?JSON.parse(t):null;}
 const leads=await call('/leads?select=id,status,commercial_stage,problem_confirmed,next_action,data_quality&limit=1000');
 if(!Array.isArray(leads))throw Error('SALES_CYCLE_INVALID_LEADS');
 const valid=leads.filter(x=>!/qa|synthetic/i.test(String(x.data_quality||'')));
 const counts={leads_checked:valid.length,contacted:valid.filter(x=>x.status==='CONTACTED').length,followups_pending:valid.filter(x=>Boolean(x.next_action)).length,interested:valid.filter(x=>x.problem_confirmed===true).length};
 const cycleKey=now.toISOString().slice(0,16).replace(/.$/,m=>m); // minute slot; unique per scheduler run
 const row={cycle_key:cycleKey,checked_at:now.toISOString(),...counts,result:'OBSERVED_NO_OUTREACH',details:{outreachSent:0,salesClosed:0,followupAutomated:false,source:'supabase'}};
 await call('/agent1_commercial_cycle_receipts?on_conflict=cycle_key',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([row])});
 const receipt=await call('/agent1_commercial_cycle_receipts?cycle_key=eq.'+encodeURIComponent(cycleKey)+'&select=cycle_key,result');
 if(!Array.isArray(receipt)||receipt.length!==1)throw Error('SALES_CYCLE_RECEIPT_MISSING');
 return {status:'RECORDED',...counts,outreachSent:0,cycleKey};
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'UNAUTHORIZED'});
 try{return res.status(200).json(await runAgent1Cycle())}catch(e){return res.status(503).json({error:String(e.message).slice(0,120)})}
}

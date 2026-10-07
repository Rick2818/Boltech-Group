import { mkdir, writeFile } from 'node:fs/promises';
const endpoint='https://boltech-group.vercel.app/api/partners';
const report={at:new Date().toISOString(),commit:process.env.GITHUB_SHA,mode:'READ_ONLY',status:'UNCONFIRMED'};
try {
  const token=process.env.PARTNER_API_TOKEN;
  if(!token)throw Error('SDR_ADMIN_AUTH_MISSING');
  async function call(action,method='GET') {
    const res=await fetch(endpoint+'?action='+action,{method,headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
    const p=await res.json();if(!res.ok||p.success!==true)throw Error(p.code||'SDR_PROBE_UNCONFIRMED');return p;
  }
  for(let i=0;i<12;i++) {try{report.configuration=await call('sdr-status');break;}catch(e){if(i===11)throw e;await new Promise(r=>setTimeout(r,5000));}}
  report.metrics=await call('sdr-metrics');
  if(report.configuration.configured)report.google=await call('sdr-verify','POST');
  report.status=report.google?.verified?'CONNECTION_VERIFIED':'AWAITING_GOOGLE_OAUTH';
}catch(e){report.status='FAILED';report.code=/^[A-Z_]+$/.test(e.message)?e.message:'SDR_PROBE_UNCONFIRMED';process.exitCode=1;}
await mkdir('ops-output',{recursive:true});await writeFile('ops-output/sdr-production-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));

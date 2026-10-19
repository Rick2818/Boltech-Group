import {mkdir,writeFile} from 'node:fs/promises';
const base='https://boltech-group.vercel.app/api/partners?action=rsi01-platform-sources';
const token=process.env.PARTNER_API_TOKEN;
const headers={Authorization:`Bearer ${token}`};
if(!token)throw Error('Operational authentication required');
const response=await fetch(base,{headers,signal:AbortSignal.timeout(55000)});
const report=await response.json();
if(!response.ok||!report.success)throw Error('Platform diagnostic unconfirmed');
// Authorization links stay in the authenticated artifact, never in public logs.
if(process.env.UPWORK_START_AUTHORIZATION==='1'&&report.upwork?.status==='BLOCKED') {
 const auth=await fetch(base,{method:'POST',headers,signal:AbortSignal.timeout(15000)});
 const result=await auth.json();
 if(auth.ok&&result.success)report.authorization=result.authorization;
 else report.authorizationError=result.code||'UPWORK_AUTHORIZATION_UNCONFIRMED';
}
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/platform-source-readiness.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,authorization:report.authorization?{created:true,completed:false}:undefined}));

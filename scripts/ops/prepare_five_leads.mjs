import {mkdir,writeFile,appendFile} from 'node:fs/promises';
const token=String(process.env.PARTNER_API_TOKEN||'').trim(),base='https://boltech-group.vercel.app/api/partners?action=rsi01-prepare';
const expected=process.env.GITHUB_EVENT_NAME==='push'?process.env.GITHUB_SHA:'';
const headers={Authorization:'Bearer '+token};
let report={state:'BLOCKED',code:'PREPARATION_NOT_OBSERVED',target:5,selected:[]};
const deadline=Date.now()+25*60000;
try{
 if(!token)throw Error('NO_MONITOR_CREDENTIAL');
 let ready=false;
 for(let i=0;i<48;i++){
  try{const r=await fetch(base,{headers,signal:AbortSignal.timeout(10000)}),d=await r.json();if(r.ok&&d.success&&d.preparation&&(!expected||d.deploymentCommit===expected)){report=d.preparation;ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,10000));
 }
 if(!ready)throw Error('PREPARATION_DEPLOYMENT_UNAVAILABLE');
 for(let attempt=0;attempt<150&&Date.now()<deadline&&(attempt===0||report.state!=='READY');attempt++){
  const res=await fetch(base,{method:'POST',headers,signal:AbortSignal.timeout(60000)}),data=await res.json();
  if(!res.ok||!data.success||!data.preparation)throw Error('PREPARATION_HTTP_UNCONFIRMED');
  report=data.preparation;
  console.log(JSON.stringify({state:report.state,complete:report.selected.length,target:5,attempts:report.attempts,code:report.code||null,lastRejection:report.rejected?.at(-1)?.code||null}));
  if(report.state==='BLOCKED')break;
 }
 if(report.state!=='READY'&&!report.code){report={...report,state:'BLOCKED',code:'PREPARATION_DEADLINE_BEFORE_FIVE'};}
}catch(e){report={...report,state:'BLOCKED',code:/^[A-Z0-9_]+$/.test(e.message)?e.message:'PREPARATION_UNCONFIRMED'};}
// Artifacts hold aggregate status only, never contact emails or individualized messages.
const sanitized={day:report.day,state:report.state,code:report.code||null,target:5,complete:report.selected.length,attempts:report.attempts,rejections:report.rejected?.reduce((a,r)=>(a[r.code]=(a[r.code]||0)+1,a),{}),recordIds:report.selected.map(r=>r.recordId)};
await mkdir('ops-output',{recursive:true});await writeFile('ops-output/rsi01-five-preparation.json',JSON.stringify(sanitized,null,2));console.log(JSON.stringify(sanitized));
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Cinco leads completos\n\n'+JSON.stringify(sanitized,null,2)+'\n');
if(report.state!=='READY'||report.selected.length!==5)process.exitCode=1;

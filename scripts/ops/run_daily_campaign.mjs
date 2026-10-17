import {mkdir,writeFile,appendFile} from 'node:fs/promises';
const base='https://boltech-group.vercel.app/api/partners?action=rsi01-daily';
const token=String(process.env.PARTNER_API_TOKEN||'').trim();
const expectedSha=(process.env.RSI_EXPECT_DEPLOYMENT_SHA ?? (process.env.GITHUB_EVENT_NAME==='push'?process.env.GITHUB_SHA:'')).trim();
let report={status:'FAILED',code:'DAILY_CAMPAIGN_UNCONFIRMED'};
try{
 if(!token)throw Error('Missing monitor credential');
 let ready=false;
 for(let attempt=0;attempt<24;attempt++){
  try{
   const state=await fetch(base,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
   const body=await state.json();
   if(state.ok&&body.success===true&&body.dailyCampaign&&
    (!expectedSha||body.deploymentCommit===expectedSha)){ready=true;break;}
  }catch{}
  await new Promise(r=>setTimeout(r,5000));
 }
 if(!ready)throw Error('Daily executor deployment unavailable');
 // No retry of a POST with an uncertain result. The shared ledger owns recovery.
 const response=await fetch(base,{method:'POST',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});
 const data=await response.json();
 if(response.ok&&data.success===true&&data.dailyCampaign)report=data.dailyCampaign;
}catch{}
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/rsi01-daily-campaign.json',JSON.stringify(report,null,2));
const summary='## RSI-01: campaña diaria\n\n'+JSON.stringify(report,null,2)+'\n';
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
if(report.status!=='EXECUTED')process.exitCode=1;

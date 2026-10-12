import {mkdir,writeFile} from 'node:fs/promises';

const base='https://boltech-group.vercel.app/api/partners';
const token=process.env.PARTNER_API_TOKEN,expected=process.env.GITHUB_SHA;
const report={at:new Date().toISOString(),commit:expected || null,status:'FAIL',sendingPerformed:false};
async function request(action,method='GET') {
  const response=await fetch(`${base}?action=${action}`,{method,headers:{Authorization:`Bearer ${token}`,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(55000)});
  let data;
  try {data=await response.json();}
  catch {throw Object.assign(new Error('Response was not JSON'),{code:'MARKETING_REPAIR_NON_JSON_RESPONSE',httpStatus:response.status});}
  if(!response.ok || data.success!==true) throw Object.assign(new Error('MARKETING_REPAIR_UNCONFIRMED'),{code:data.code});
  return data;
}
try {
  if(!token || !/^[a-f0-9]{40}$/.test(expected || '')) throw Object.assign(new Error('Configuration missing'),{code:'MARKETING_REPAIR_CONFIGURATION_REQUIRED'});
  let ready=false;
  for(let attempt=0;attempt<36;attempt++) {
    try {const state=await request('rsi-agents');if(state.deploymentCommit===expected && state.executorVersion>=13){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  if(!ready) throw Object.assign(new Error('Production deployment pending'),{code:'MARKETING_REPAIR_DEPLOYMENT_PENDING'});
  report.before=await request('marketing-maintenance');
  // Exactly one POST. An uncertain response is followed by readback, never a blind retry.
  try {report.repair=await request('marketing-maintenance','POST');}
  catch(error) {report.mutationCode=typeof error.code==='string'?error.code:'MARKETING_REPAIR_RESPONSE_UNKNOWN';report.mutationHttpStatus=error.httpStatus || null;}
  report.after=await request('marketing-maintenance');
  if(!report.repair || report.after.events.length!==4 || !report.after.events.every(row=>row.version===2 && row.reviewed)) {
    throw Object.assign(new Error('Reconciliation required'),{code:'MARKETING_REPAIR_RECONCILIATION_REQUIRED'});
  }
  report.status=report.repair.results.some(row=>row.history?.status==='UNVERIFIED')?'ATTENTION':'PASS';
}catch(error){report.code=/^MARKETING_[A-Z_]+$/.test(error.code || '')?error.code:'MARKETING_REPAIR_UNCONFIRMED';process.exitCode=1;}
finally {
  await mkdir('ops-output',{recursive:true});
  await writeFile('ops-output/marketing-production-repair.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}

import {readFile,mkdir,writeFile,appendFile} from 'node:fs/promises';
export const remediationFor=code=>({
 WAITING_VERIFIED_PARTNER:{owner:'MARKETING',action:'Verify partner identity, consent and collaboration evidence; do not invent referrals.'},
 COST_EVIDENCE_INCOMPLETE:{owner:'RSI-03',action:'Reconcile actual service delivery and provider cost records; do not infer missing amounts.'},
 WAITING_QUALIFIED_APPROVED_CASE:{owner:'RSI-02',action:'Inspect validated customer replies and request qualified customer scope; do not fabricate interest.'}
}[code]||{owner:'DIRECTORA',action:'Investigate evidence and escalate unresolved blocker.'});
let report={status:'FAILED',checkedAt:new Date().toISOString(),reason:'DIRECTOR_CYCLE_RECEIPT_MISSING'};
try {
 const raw=JSON.parse(await readFile('ops-output/rsi-agent-execution.json','utf8'));
 const results=Array.isArray(raw.results)?raw.results:[];
 const roles=['RSI-02','RSI-03'];
 const validated=roles.every(role=>results.some(r=>r.rsi===role&&r.success===true&&r.receipt?.outcome==='COMPLETED'));
 const notification=raw.directorNotification;
 const noticeOk=notification?.success===true&&typeof notification.status==='string';
 const blockers=results.flatMap(r=>(r.receipt?.blockers||[]).map(code=>({role:r.rsi,code,...remediationFor(code)})));
 const urgent=blockers.length>0;
 report={checkedAt:new Date().toISOString(),status:validated&&noticeOk?'VERIFIED':'FAILED',agents:roles.map(role=>({role,verified:results.some(r=>r.rsi===role&&r.success===true&&r.receipt?.outcome==='COMPLETED')})),notification:notification?.status||'UNCONFIRMED',blockers,requiresCommercialAttention:urgent,followupRequired:urgent,nextAction:urgent?'Agent 4 must track these owner-assigned blockers in the next hourly cycle.':'Continue hourly oversight.',reason:validated&&noticeOk?null:'AGENT_OR_DIRECTOR_RECEIPT_UNCONFIRMED',saleInferred:false};
}catch(e){report.errorCode='MISSING_OR_INVALID_RECEIPT';}
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/director-hourly-audit.json',JSON.stringify(report,null,2));
const output='## Director hourly oversight\n\n'+JSON.stringify(report,null,2)+'\n';
console.log(output);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,output);
if(report.status!=='VERIFIED')process.exitCode=1;

import {readFile,mkdir,writeFile,appendFile} from 'node:fs/promises';
import {remediationFor} from '../../lib/director_remediation.js';
import {reviewBlockers} from '../../lib/director_blocker_tracking.js';
let report={status:'FAILED',checkedAt:new Date().toISOString(),reason:'DIRECTOR_CYCLE_RECEIPT_MISSING'};
try {
 const raw=JSON.parse(await readFile('ops-output/rsi-agent-execution.json','utf8'));
 const results=Array.isArray(raw.results)?raw.results:[];
 const roles=['RSI-02','RSI-03'];
 const validated=roles.every(role=>results.some(r=>r.rsi===role&&r.success===true&&r.receipt?.outcome==='COMPLETED'));
 const notification=raw.directorNotification;
 const noticeOk=notification?.success===true&&typeof notification.status==='string';
 const blockers=results.flatMap(r=>(r.receipt?.blockers||[]).map(code=>({role:r.rsi,code,...remediationFor(code)})));
 let prior=[];try{const history=JSON.parse(await readFile('ops-output/director-blockers-history.json','utf8'));prior=[...new Map([...(history.absent||[]),...(history.active||[])].map(b=>[b.role+':'+b.code,b])).values()];}catch{}
 // Only the originating role's current receipt can retire its historical blocker.
 const resolutions=results.flatMap(r=>(r.success===true&&r.receipt?.outcome==='COMPLETED'&&Array.isArray(r.receipt.resolutions)?r.receipt.resolutions:[]).map(proof=>({...proof,role:r.rsi})));
 const tracking=reviewBlockers(prior,blockers,new Date().toISOString(),resolutions);
 await writeFile('ops-output/director-blockers-history.json',JSON.stringify(tracking,null,2));
 let marketing={verified:false,code:'MARKETING_RECEIPT_MISSING'};
 try {const m=JSON.parse(await readFile('ops-output/marketing-autonomy-execution.json','utf8'));const row=(m.results||[]).find(x=>x.rsi==='MARKETING');marketing={verified:row?.success===true&&row.receipt?.outcome==='COMPLETED'&&Number(row.receipt?.actionCount)>=2,runId:row?.receipt?.runId||null};if(!marketing.verified)marketing.code='MARKETING_EXECUTION_UNCONFIRMED';}catch{}
 // A completed technical cycle cannot close unresolved commercial blockers.
 // Disappearance from one receipt is not evidence that a blocker was resolved.
 const unresolved=tracking.absent||[];
 const urgent=blockers.length>0||unresolved.length>0;
 const technicalCycleVerified=validated&&noticeOk&&marketing.verified;
 report={checkedAt:new Date().toISOString(),status:!technicalCycleVerified?'FAILED':urgent?'ATTENTION_REQUIRED':'VERIFIED',scope:'TECHNICAL_OVERSIGHT_ONLY',technicalCycleVerified,customerFollowupVerified:false,agents:roles.map(role=>({role,verified:results.some(r=>r.rsi===role&&r.success===true&&r.receipt?.outcome==='COMPLETED')})),notification:notification?.status||'UNCONFIRMED',marketing,blockers,tracking,requiresCommercialAttention:urgent,followupRequired:urgent,nextAction:urgent?'Agent 4 must obtain owner action and resolution evidence for active or absent blockers in the next hourly cycle. A completed cycle is not a sent customer follow-up.':'Continue hourly oversight; verify customer sends separately through provider receipts.',reason:!technicalCycleVerified?'AGENT_MARKETING_OR_DIRECTOR_RECEIPT_UNCONFIRMED':urgent?'COMMERCIAL_BLOCKERS_UNRESOLVED':null,saleInferred:false};
}catch(e){report.errorCode='MISSING_OR_INVALID_RECEIPT';}
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/director-hourly-audit.json',JSON.stringify(report,null,2));
const output='## Director hourly oversight\n\n'+JSON.stringify(report,null,2)+'\n';
console.log(output);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,output);
if(report.status!=='VERIFIED')process.exitCode=1;

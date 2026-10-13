// Deterministic fault lab — no real provider, payments, email or network usage.
import {runSynthetic} from './runner.mjs';
import {CaseLedger,message} from './core.mjs';
import {safeRetry} from './redis-adapter.mjs';
export function runFaultLab(){
 const results=[];const record=(name,fn)=>{try{fn();results.push({name,result:'PASS'});}catch(err){results.push({name,result:'FAIL',error:String(err.message)});}};
 const assert=(ok,reason)=>{if(!ok)throw Error(reason)};
 record('P01 full commercial synthetic path',()=>{const x=runSynthetic({runId:'fault-lab'});assert(x.report.stage==='CLOSED_WON'&&x.report.revenue_real===0,'bad close');});
 record('P02 twenty directions',()=>{let n=0;for(let i=1;i<=5;i++)for(let j=1;j<=5;j++)if(i!==j){message({source:'A'+i,destination:'A'+j,action:'PING',caseId:'SYN-E2E-001',runId:'ping'});n++;}assert(n===20,'missing pair');});
 record('P03 duplicate handoff',()=>{const x=new CaseLedger();const m=message({source:'A1',destination:'A2',action:'TRANSFER',caseId:x.caseId,runId:'one',taskId:'constant'});assert(x.deliver(m)&&!x.deliver(m),'duplicate accepted');});
 record('P04 restart model',()=>{const a=runSynthetic({runId:'restart-fixture'});assert(a.report.stage==='CLOSED_WON','not closed');}); // logical replay only; no actual worker restart
 record('P07 duplicate payment event in memory',()=>{const x=new CaseLedger();for(const [s,a] of [['RESEARCHING','A1'],['QUALIFIED','A1'],['PROPOSAL_PREPARING','A2'],['PROPOSAL_SENT','A2'],['NEGOTIATION','A3'],['ACCEPTED','A3'],['PAYMENT_PENDING','A3']])x.transit(s,{key:s,agent:a});assert(x.transit('PAYMENT_CONFIRMED',{key:'sandbox-webhook',agent:'A3'}),'first event');assert(!x.transit('PAYMENT_CONFIRMED',{key:'sandbox-webhook',agent:'A3'}),'duplicated event');});
 record('P09 unknown email must not be retried',()=>assert(safeRetry({kind:'SEND_UNKNOWN',attempts:0})===false,'retry unsafe'));
 record('P11 hop guard',()=>{let blocked=false;try{message({source:'A2',destination:'A1',action:'REPEAT',caseId:'SYN-E2E-001',runId:'hops',hops:11});}catch{blocked=true;}assert(blocked,'cycle not guarded')});
 record('P15 rerun same fixture no real sales',()=>{const x=runSynthetic({runId:'alpha'}),y=runSynthetic({runId:'beta'});assert(x.report.case_id===y.report.case_id&&x.report.revenue_real===0&&y.report.revenue_real===0,'fixture duplicated');});
 const untested=['P05 Airtable outage recovery','P06 Redis restart','P08 webhook signature validation','P10 A4 cloud outage','P12 live MCP unavailability','P13 prompt-injection guardrails','P14 database concurrency'];
 for(const name of untested)results.push({name,result:'NOT_IMPLEMENTED'});
 return {suite:'ASMAS V4.1 FAULT LAB',synthetic_case_id:'SYN-E2E-001',environment:'OFFLINE_SIMULATION',results,passed:results.filter(x=>x.result==='PASS').length,not_implemented:results.filter(x=>x.result==='NOT_IMPLEMENTED').length,failed:results.filter(x=>x.result==='FAIL').length,certified:false};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)console.log(JSON.stringify(runFaultLab(),null,2));

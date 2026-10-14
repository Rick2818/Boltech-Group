// Synthetic E2E runner: exactly ONE fixture; each run gets a distinct run_id.
import {randomUUID} from 'node:crypto';
import {CaseLedger,ROUTE,message} from './core.mjs';
export function runSynthetic({runId=randomUUID()}={}){
 const ledger=new CaseLedger();
 const handoffs=[];
 for(let i=0;i<ROUTE.length-1;i++){
  const m=message({source:ROUTE[i],destination:ROUTE[i+1],action:'TRANSFER',caseId:ledger.caseId,runId,taskId:'handoff-'+i});
  ledger.deliver(m);handoffs.push(m);
 }
 const stages=[
 ['RESEARCHING','A1'],['QUALIFIED','A1'],['PROPOSAL_PREPARING','A2'],
 ['PROPOSAL_SENT','A2'],['FOLLOW_UP','A2'],['NEGOTIATION','A3'],
 ['ACCEPTED','A3'],['PAYMENT_PENDING','A3'],['PAYMENT_CONFIRMED','A3'],['CLOSED_WON','A3']
 ];
 for(const [stage,agent] of stages)ledger.transit(stage,{key:runId+':stage:'+stage,agent,evidence:{simulated:true}});
 return {ledger,runId,handoffs,report:{...ledger.report(),quote_usd_simulated:1000,contact:'compras@cliente-sintetico.example',result:'PASS_SIMULATED'}};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const {report}=runSynthetic();process.stdout.write(JSON.stringify(report,null,2)+'\n');
}

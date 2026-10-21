// ARCHIVED 2026-10-21: legacy RSI-01 commercial implementation, NOT approved for production execution.
import {extractApprovedCandidate} from './sdr_campaign.js';
import {validateSdrCandidate} from './sdr_dispatch.js';
export function dailyFiveReadiness(preparation,leads,now=new Date()){
 const selected=preparation?.selected||[],ids=new Set(selected.map(s=>s.recordId));
 const domainSet=new Set(selected.map(s=>s.domain));
 if(preparation?.state!=='READY'||selected.length!==5||ids.size!==5||domainSet.size!==5)return {target:5,ready:false,complete:0};
 try{for(const item of selected){const candidate=extractApprovedCandidate(leads.find(l=>l.id===item.recordId));if(!candidate||candidate.email!==item.email||candidate.commercialResearch.accountKey!==item.domain)throw Error('identity');validateSdrCandidate(candidate,now);}}
 catch{return {target:5,ready:false,complete:0};}
 return {target:5,ready:true,complete:5,scope:'INITIAL_OUTREACH_PREPARATION',buyerAuthorityConfirmed:false,customerNeedConfirmed:false};
}

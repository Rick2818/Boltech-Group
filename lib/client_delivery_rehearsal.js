import { createHash } from 'node:crypto';
export async function rehearseDelivery({orderId='SYN-KATIA-001', failFirst=false}={}){
 if(!/^SYN-[A-Z0-9-]{3,64}$/.test(orderId))throw Error('SYNTHETIC_ONLY');
 const events=[];let attempt=0;
 const receipt=(role,status,detail)=>events.push({role,status,detail});
 receipt('E1_IMPLEMENTATION','PASS','Synthetic order specification and mock ecommerce workflow compiled');
 const runQa=()=>{attempt++;if(failFirst&&attempt===1)throw Error('SIMULATED_TRANSIENT_QA_FAILURE');return true;};
 try{runQa();receipt('E2_QA','PASS','Mock scenario tested');}
 catch(e){receipt('E2_QA','BLOCKED',e.message);receipt('E4_RSI','RECOVERED','Single controlled retry after synthetic transient failure');runQa();receipt('E2_QA','PASS','Mock scenario passed after retry');}
 const qaPassed=events.some(e=>e.role==='E2_QA'&&e.status==='PASS');
 if(!qaPassed)throw Error('QA_NOT_PASSED');
 receipt('E3_CERTIFICATION','PASS','Synthetic evidence complete; not a customer delivery');
 const digest=createHash('sha256').update(JSON.stringify({orderId,events})).digest('hex');
 return {schemaVersion:1,orderId,kind:'SYNTHETIC_ONLY',status:'PASS',customerAccepted:false,customerDelivered:false,attempts:attempt,events,digest};
}

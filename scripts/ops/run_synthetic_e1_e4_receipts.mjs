import {mkdir,writeFile} from 'node:fs/promises';
import {rehearseDelivery} from '../../lib/client_delivery_rehearsal.js';
const orderId='SYN-KATIA-001';
const results=[];
for(const scenario of [{name:'normal',failFirst:false},{name:'qa-recovery',failFirst:true}]){
 const receipt=await rehearseDelivery({orderId,failFirst:scenario.failFirst});
 if(receipt.status!=='PASS'||receipt.customerAccepted||receipt.customerDelivered)throw Error('SYNTHETIC_RECEIPT_INVALID');
 if(scenario.failFirst && !(receipt.attempts===2 && receipt.events.some(x=>x.role==='E4_RSI'&&x.status==='RECOVERED')))throw Error('RECOVERY_NOT_PROVEN');
 results.push({scenario:scenario.name,...receipt});
}
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/synthetic-order-e1-e4-receipts.json',JSON.stringify({generatedAt:new Date().toISOString(),orderId,certification:'SYNTHETIC_PASS_ONLY',results},null,2));
console.log(JSON.stringify({orderId,certification:'SYNTHETIC_PASS_ONLY',scenarios:results.map(x=>({scenario:x.scenario,status:x.status,attempts:x.attempts,roles:x.events.map(z=>z.role),digest:x.digest}))}));

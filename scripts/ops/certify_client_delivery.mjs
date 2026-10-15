import { mkdir, writeFile } from 'node:fs/promises';
import { checkDelivery } from '../../lib/client_delivery_certification.js';
const result=await checkDelivery({orderId:process.env.ORDER_ID,mode:process.env.DELIVERY_MODE,url:process.env.VERCEL_URL});
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/client-delivery-certification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({orderId:result.orderId,status:result.status,checks:result.checks,blockers:result.blockers}));
if(result.status!=='PASS')process.exitCode=1;

import {createHmac} from 'node:crypto';
import {createCustomerSandbox,createSandboxStore,PDRO_PROFILE} from '../../lib/customer_support_sandbox.js';
import {PDRO_TEST_BUSINESS} from '../../lib/pdro_test_business.js';
export async function runBusinessAcceptance(directory){
 const profile={...PDRO_PROFILE,knowledge:PDRO_TEST_BUSINESS};
 const credentials={appSecret:'synthetic-business-signature-local-only',verifyToken:'synthetic-business-verification-local-only'};
 const app=createCustomerSandbox({store:createSandboxStore(directory),profile,...credentials});await app.provision();
 const transcript=[];
 async function send(id,text,from){
  const raw=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:profile.phoneNumberId},messages:[{id,from,type:'text',text:{body:text}}]}}]}]}));
  const result=await app.receive(raw,'sha256='+createHmac('sha256',credentials.appSecret).update(raw).digest('hex'));
  transcript.push({message:text,...result});return result;
 }
 const priced=await send('SYN_BUS_1','Precio del filtro de aire','SYN_BUS_A');
 const quote=await send('SYN_BUS_2','Necesito dos unidades','SYN_BUS_A');
 const closed=await app.resolveTicket(quote.ticketId,{note:'Pedro revisó la solicitud ficticia. No se confirmó una venta.'});
 const unavailable=await send('SYN_BUS_3','Tienen batería','SYN_BUS_B');
 const hours=await send('SYN_BUS_4','Cuál es el horario','SYN_BUS_C');
 const recovered=createCustomerSandbox({store:createSandboxStore(directory),profile,...credentials});
 const raw=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:profile.phoneNumberId},messages:[{id:'SYN_BUS_5',from:'SYN_BUS_A',type:'text',text:{body:'Hola'}}]}}]}]}));
 const resumed=await recovered.receive(raw,'sha256='+createHmac('sha256',credentials.appSecret).update(raw).digest('hex'));transcript.push({message:'Hola, después de cerrar el caso y reiniciar',...resumed});
 if(priced.intent!=='CATALOG_INFORMATION'||quote.intent!=='QUOTE_REVIEW'||closed.status!=='RESOLVED'||unavailable.intent!=='PRODUCT_UNAVAILABLE'||hours.intent!=='BUSINESS_HOURS'||resumed.intent!=='GREETING')throw Error('BUSINESS_ACCEPTANCE_FAILED');
 const state=await recovered.snapshot();
 return {mode:'SYNTHETIC_ONLY',knowledge:PDRO_TEST_BUSINESS,messages:transcript.length,capturedReplies:state.outbox.length,resolvedCases:state.tickets.filter(t=>t.status==='RESOLVED').length,openCases:state.tickets.filter(t=>t.status==='OPEN').length,resumedAfterResolutionAndRestart:true,externalNotificationsSent:false,transcript};
}

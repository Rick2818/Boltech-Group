import {getAgentExecutionStatus} from './rsi_agent_status.js';
import {getVerifiedSalesMetrics} from './payment_store.js';
import {createInteragentCoordinator} from './interagent_coordinator.js';
export const FREE_BOT_HELP='Ricardo, comandos disponibles:\n/estado — última ejecución de los cuatro agentes\n/ventas — cobros comerciales registrados\n/mercadeo — solicitudes, aceptación, uso y resultados\nEl texto libre y las notas de voz se responden con Gemini cuando está activo en el servidor.';
export async function freeOperationalReply(text,{agents=getAgentExecutionStatus,sales=getVerifiedSalesMetrics,marketing=()=>createInteragentCoordinator().marketing.metrics()}={}){
 const command=text.trim().toLowerCase();
 try{
  if(command==='/estado'||command==='/proyectos'){const s=await agents();return 'Últimos recibos de ejecución:\n'+s.agents.map(a=>`${a.rsi}: ${a.state}${a.receiptAgeMinutes!=null?` (${a.receiptAgeMinutes} min)`:''}`).join('\n')+'\nUna ejecución completada no demuestra una venta ni disponibilidad continua.';}
  if(command==='/ventas'){const s=await sales();return `Cobros comerciales registrados: ${s.paidOrders}.\nImporte: USD${s.cashCollectedUsd}.\nExcluye la prueba QA de pago.`;}
  if(command==='/mercadeo'){const s=await marketing();return `Mercadeo: ${s.requested} solicitudes; ${s.accepted} aceptadas; ${s.used} con uso comprobado; ${s.resultsVerified} con respuesta del cliente.\nPendientes de aceptación: ${s.pendingAcceptance}; pendientes de uso: ${s.pendingUse}.\nUna respuesta no demuestra una venta.`;}
 }catch{return 'No pude verificar esos datos ahora. No he ejecutado acciones ni atribuido resultados. Intente nuevamente la consulta.';}
 return FREE_BOT_HELP;
}

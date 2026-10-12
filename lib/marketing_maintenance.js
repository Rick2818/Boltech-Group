import {createInteragentCoordinator} from './interagent_coordinator.js';
import {marketingErrorCode} from './rsi_marketing_cycle.js';

const scope = Object.freeze({
  'adk-support-RSI-01-2026-10-07':'RSI-01',
  'adk-support-RSI-02-2026-10-07':'RSI-02',
  'adk-support-RSI-03-2026-10-07':'RSI-03',
  'marketing-leadflow-RSI01-20261009':'RSI-01'
});
const fail = code => {throw Object.assign(new Error(code),{code,statusCode:409});};
const clean = value => String(value || '').replace(/[\x00-\x1f]/g,' ').trim().slice(0,250);

// Administrative repair is restricted to these four existing private drafts.
// It cannot create an event, revise used material, send mail, approve a quote or charge.
export function createMarketingMaintenance(worker = createInteragentCoordinator()) {
  async function existing() {
    const queue = await worker.queue('MARKETING');
    const rows = queue.pending.filter(row => Object.hasOwn(scope,row.eventId));
    if(rows.length!==4 || new Set(rows.map(row=>row.eventId)).size!==4) fail('MARKETING_EXISTING_SCOPE_CHANGED');
    for(const row of rows) {
      if(row.from!==scope[row.eventId] || !row.material || row.marketingUse || row.usedBySales) fail('MARKETING_EXISTING_USE_REVIEW_REQUIRED');
    }
    return rows;
  }
  async function inspect() {
    const rows=await existing();
    return {success:true,existingEvents:rows.length,events:rows.map(row=>({eventId:row.eventId,from:row.from,
      version:row.material.version,reviewed:row.marketingReview?.materialFingerprint===row.material.fingerprint,
      state:row.marketingDisposition?.decision?.state || 'UNREVIEWED'})),sendingPerformed:false};
  }
  async function repair() {
    const rows=await existing(),results=[];
    for(const row of rows) {
      const account=await worker.readOpportunity(row.opportunityId);
      if(account?.id!==row.opportunityId || !account.fields?.Name || account.fields['Data Quality']==='QA') fail('MARKETING_ACCOUNT_UNVERIFIED');
      const name=clean(account.fields.Name),source=clean(account.fields['Source Evidence URL']||account.fields['Company URL']);
      const supplier=row.eventId==='marketing-leadflow-RSI01-20261009';
      const kind=supplier?'SUPPLIER_FIT':row.from==='RSI-02'?'WRITTEN_DIAGNOSIS_AND_DEMONSTRATION':row.from==='RSI-03'?'SCOPE_VALUE_AND_OBJECTIONS':'MESSAGE_AND_FIT';
      const need=supplier?`Comprobar encaje de Boltech como proveedor por proyecto para ${name}; financiación y requisito de portafolio siguen sin confirmar. Esperar respuesta al contacto existente.`:
        row.from==='RSI-01'?`Investigar el proceso de solicitudes de ${name}${source?' con fuente '+source:''}; verificar responsable, necesidad e historial antes de contacto.`:
        row.from==='RSI-02'?`Preparar diagnóstico escrito del proceso de ${name}; solicitar herramientas, volumen, responsable y criterio medible únicamente después de respuesta humana verificada.`:
        `Preparar explicación de alcance y objeciones para ${name}; no existe cierre autorizado sin calificación, costos documentados y condiciones individuales aprobadas.`;
      const deliverable=supplier?'Ficha privada de encaje como proveedor; preguntas sobre proyecto financiado, herramientas, plazo y portafolio externo.':
        row.from==='RSI-01'?'Ficha de investigación de la cuenta y preguntas sobre el paso manual; revisar historial y permisos antes de contacto.':
        row.from==='RSI-02'?'Preguntas de diagnóstico por escrito y criterios de demostración con permiso; conservar el hilo del cliente.':
        'Resumen de alcance, exclusiones y preguntas sobre la objeción real; usar solo la cotización individual aprobada.';
      const supportRequest={kind,need,deliverable,evidenceRefs:[row.opportunityId,row.eventId]};
      const input={from:row.from,eventId:row.eventId};
      const revised=await worker.marketing.revise({...input,materialFingerprint:row.material.fingerprint,supportRequest});
      const fingerprint=revised.materialFingerprint || row.material.fingerprint;
      await worker.marketing.review({...input,materialFingerprint:fingerprint});
      let history;
      try {history=await worker.marketing.reconcile(input);}
      catch(error) {history={status:'UNVERIFIED',code:marketingErrorCode(error),sendingPerformed:false};}
      const managed=await worker.marketing.manage(input);
      results.push({eventId:row.eventId,from:row.from,reused:!!revised.reused,state:managed.state,history,
        reviewed:true,sendingPerformed:false});
    }
    const verified=await inspect();
    if(!verified.events.every(row=>row.version===2 && row.reviewed)) fail('MARKETING_REPAIR_READBACK_FAILED');
    return {...verified,results,applied:true,usedMaterialPreserved:true,sendingPerformed:false};
  }
  return {inspect,repair};
}

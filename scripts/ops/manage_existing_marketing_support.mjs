import fs from 'node:fs/promises';
import {signInteragent} from '../../lib/interagent_coordinator.js';
const apply=process.argv.includes('--apply');
const auth=JSON.parse(await fs.readFile(process.env.BOLTECH_SIGNING_FILE||'scratch/commercial-scale/n8n-runtime/client-auth.json','utf8'));
async function request(input){const body={...input,signedAt:new Date().toISOString()};const r=await fetch('https://boltech-group.vercel.app/api/partners?action=interagent',{method:'POST',headers:{'Content-Type':'application/json','X-Boltech-Signature':signInteragent(body,auth.roleKeys[body.from])},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok||d.success!==true)throw Error(d.code||'MARKETING_RESULT_UNCONFIRMED');return d;}
const expected=new Set(['adk-support-RSI-01-2026-10-07','adk-support-RSI-02-2026-10-07','adk-support-RSI-03-2026-10-07','marketing-leadflow-RSI01-20261009']);
const queue=await request({operation:'queue',from:'MARKETING'});
const rows=queue.pending.filter(r=>expected.has(r.eventId));if(rows.length!==4)throw Error('MARKETING_EXISTING_SCOPE_CHANGED');
const results=[];
for(const row of rows){
 if(row.marketingUse)throw Error('MARKETING_EXISTING_USE_REVIEW_REQUIRED');
 const supplier=row.eventId==='marketing-leadflow-RSI01-20261009';
 const supportRequest={kind:supplier?'SUPPLIER_FIT':row.from==='RSI-02'?'WRITTEN_DIAGNOSIS_AND_DEMONSTRATION':row.from==='RSI-03'?'SCOPE_VALUE_AND_OBJECTIONS':'MESSAGE_AND_FIT',need:supplier?'Comprobar encaje como proveedor por proyecto; financiación y requisitos de portafolio externo siguen sin confirmar. Esperar respuesta al contacto existente.':row.from==='RSI-01'?'Verificar encaje empresarial y necesidad del registro CRM existente antes de autorizar contacto.':row.from==='RSI-02'?'Preparar diagnóstico del registro CRM existente, condicionado a respuesta humana y datos del proceso.':'Preparar explicación de alcance y objeciones del registro CRM existente, condicionada a calificación y condiciones aprobadas.',deliverable:supplier?'Ficha privada de encaje como proveedor, preguntas de proyecto y requisito de portafolio.':row.from==='RSI-01'?'Ficha privada de investigación y preguntas de encaje; no enviar.':row.from==='RSI-02'?'Preguntas de diagnóstico y criterios para demostración autorizada; no enviar.':'Preguntas sobre alcance y objeción real; sin precio universal ni envío.',evidenceRefs:[row.opportunityId,row.eventId]};
 if(!apply){results.push({eventId:row.eventId,from:row.from,supportRequest,operation:'REVISE_EXISTING_ONLY'});continue;}
 await request({operation:'marketing-revise',from:row.from,eventId:row.eventId,materialFingerprint:row.material.fingerprint,supportRequest});
 // Leave corrected content pending sales review. Never manufacture acceptance or send.
 results.push(await request({operation:'marketing-manage',from:row.from,eventId:row.eventId}));
}
console.log(JSON.stringify({applied:apply,existingEvents:4,results,sendingPerformed:false},null,2));

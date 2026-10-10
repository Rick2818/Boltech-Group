import { queueContactSync } from './crm_recovery.js';
import { redisCommand } from './rsi_handoff_store.js';

const LEADS = 'tblZaox2MX5uYA5PZ', WORK = 'tblHVqUMifOFjlGvj';
export async function receptionTable(table, { formula, method = 'GET', body } = {}) {
  const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT;
  if (!token) throw Error('RECEPTION_STORE_NOT_CONFIGURED');
  const url = new URL(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID || 'appCQZd0IhBHFoZ9P'}/${table}`);
  if (formula) url.searchParams.set('filterByFormula', formula);
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw Error('RECEPTION_STORE_UNAVAILABLE');
  const data = await response.json();
  if (!Array.isArray(data.records) || data.offset) throw Error('RECEPTION_READ_UNCONFIRMED');
  return data.records;
}
export function validateReception(input = {}) {
  const clean = {};
  for (const [key, max] of Object.entries({email:254,companyName:120,painPoint:1000,workflow:1000,impact:500,tools:200,decision:500,result:500,limits:500})) {
    if (typeof input[key] !== 'string' || input[key].length > max) throw Error('RECEPTION_INVALID_INPUT');
    clean[key] = input[key].trim();
  }
  clean.email = clean.email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email) || /[\x00-\x1f]/.test(clean.email) ||
      Object.values(clean).some(value=>!value) || clean.painPoint.length < 4 || input.consent !== true) throw Error('RECEPTION_INVALID_INPUT');
  return clean;
}
// Reuses the existing CRM recovery, Leads and RSI Agent Work. No email dispatch or new agent.
export async function receiveWebLead(input, {queue=queueContactSync, request=receptionTable, command=redisCommand, now=()=>new Date().toISOString()} = {}) {
  const lead = validateReception(input);
  const crm = await queue({...lead, message:JSON.stringify({workflow:lead.workflow,impact:lead.impact,tools:lead.tools,decision:lead.decision,result:lead.result,limits:lead.limits}), service:'RSI-01 web reception'});
  if (!/^[a-f0-9]{64}$/.test(crm?.jobId || '')) throw Error('RECEPTION_PERSISTENCE_UNCONFIRMED');
  const requestId = crm.jobId, key = `boltech:web-reception:${requestId}`;
  const saved = await command(['GET',key]);
  if (saved) return JSON.parse(saved);
  const formula = `{Contact Email}=${JSON.stringify(lead.email)}`;
  const matches = await request(LEADS,{formula});
  if(matches.length>1) throw Error('RECEPTION_DUPLICATE_CONTACT_REVIEW');
  let contact=matches[0];
  if(contact && (contact.fields?.Unsubscribed || contact.fields?.['Do Not Contact'] || /do not contact|unsubscribed|bounced/i.test([contact.fields?.Status,contact.fields?.['Commercial Stage']].join(' ')))) throw Error('RECEPTION_CONTACT_REVIEW_REQUIRED');
  if(!contact) {
    const rows=await request(LEADS,{method:'PATCH',body:{performUpsert:{fieldsToMergeOn:['Contact Email']},records:[{fields:{Name:lead.companyName,'Contact Email':lead.email,'Experiment Cohort':'RSI-01','Source Evidence URL':'https://boltech-group.vercel.app/','Commercial Stage':'Researching',Notes:'Solicitud entrante desde asistente web; correo declarado, no verificado. Sin aceptación ni pago.'}}]}});
    contact=rows[0];
  }
  if(!/^rec[a-zA-Z0-9]{14}$/.test(contact?.id||'')) throw Error('RECEPTION_CONTACT_UNCONFIRMED');
  const confirmed=await request(LEADS,{formula});
  if(confirmed.length!==1 || confirmed[0].id!==contact.id || String(confirmed[0].fields?.['Contact Email']).toLowerCase()!==lead.email) throw Error('RECEPTION_CONTACT_UNCONFIRMED');
  const workId=`WEB_INTAKE:${requestId}`, at=now();
  const fields={'Work ID':workId,RSI:'RSI-01',Owner:'RSI-01 — responsable diario de ventas',Status:'PENDING_RSI01_RESEARCH','Source Record ID':contact.id,'Handoff To':'RSI-02','Updated At':at,
    Evidence:JSON.stringify({kind:'RSI01_WEB_INTAKE_V1',requestId,leadId:contact.id,...lead,consent:true,receivedAt:at,emailVerified:false,customerAcceptance:false,paymentVerified:false}),
    Authorization:'Contacto solicitado por visitante web para esta necesidad. Revisar identidad, historial y exclusiones; no campañas, gastos ni compromisos nuevos.',
    'Next Action':'RSI-01: revisar solicitud web y contacto declarado; aclarar proceso, impacto, decisión, plazo y límites por escrito. Transferir a RSI-02 después de calificación. No asumir correo verificado.'};
  await request(WORK,{method:'PATCH',body:{performUpsert:{fieldsToMergeOn:['Work ID']},records:[{fields}]}});
  const work=await request(WORK,{formula:`{Work ID}=${JSON.stringify(workId)}`});
  if(work.length!==1 || work[0].fields?.Evidence!==fields.Evidence || work[0].fields?.RSI!=='RSI-01') throw Error('RECEPTION_ASSIGNMENT_UNCONFIRMED');
  const result={success:true,registration:{status:'RECORDED',requestId},assignment:{owner:'RSI-01',status:'QUEUED'},contactSyncStatus:crm.status};
  await command(['SET',key,JSON.stringify(result)]);
  return result;
}

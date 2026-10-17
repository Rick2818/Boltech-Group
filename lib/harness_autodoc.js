// Stores execution metadata, never secrets, customer payloads, logs or artifacts.
export const HARNESS_ISSUE = 86;
export const MARKER = '<!-- BOLTECH_HARNESS_AUTODOC_V1 -->';
export const TRACKED = Object.freeze({
  'sdr_connection_verification.yml':'Gmail / SDR: verificación de conexión',
  'client_delivery_certification.yml':'Entrega: infraestructura y pruebas sintéticas',
  'boltech_validation.yml':'Validación técnica y lógica comercial',
  'asmas_rsi01_9am.yml':'ASMAS: ejecución y campaña autorizada',
  'boltech_health_check.yml':'Salud de producción',
  'boltech_crm_sync.yml':'Recuperación e integridad CRM',
  'rsi_traction_validation.yml':'Validación de tracción RSI',
  'followup-safety.yml':'Seguridad de seguimientos',
  'crm_regression.yml':'Regresión CRM',
  'apollo_production_acceptance.yml':'Aceptación del conector Apollo',
  'audit_apollo_production.yml':'Auditoría del conector Apollo',
  'boltech_daily_report.yml':'Informe ejecutivo',
  'telegram_diagnose.yml':'Diagnóstico Telegram',
  'telegram_recovery_once.yml':'Recuperación Telegram',
  'wompi_verification_recovery.yml':'Recuperación de verificación Wompi'
});
const fail=code=>{throw Error(code);};
const conclusions=new Set(['success','failure','cancelled','skipped','timed_out','action_required','neutral','stale','startup_failure']);
export function normalizeRun(run,repository){
  const file=String(run.path||'').split('@')[0].split('/').at(-1);
  if(!TRACKED[file]||run.status!=='completed'||run.head_branch!=='main'||run.repository?.full_name!==repository||run.head_repository?.full_name!==repository)return null;
  if(!Number.isSafeInteger(run.id)||run.id<1||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1||!/^[a-f0-9]{40}$/i.test(run.head_sha||'')||!conclusions.has(run.conclusion)||!Number.isFinite(Date.parse(run.updated_at)))fail('HARNESS_INVALID_RUN_METADATA');
  return {workflow:file,scope:TRACKED[file],runId:run.id,attempt:run.run_attempt,branch:'main',sha:run.head_sha,conclusion:run.conclusion,completedAt:run.updated_at,url:`https://github.com/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}`,artifacts:[]};
}
export function readState(body){
  if(!body?.includes(MARKER))fail('HARNESS_WRONG_ISSUE');
  const raw=body.match(/<!-- HARNESS_STATE\n([\s\S]*?)\nHARNESS_STATE -->/);
  if(!raw)return {version:1,latest:{},history:[]};
  let state;try{state=JSON.parse(raw[1]);}catch{fail('HARNESS_STATE_CORRUPT');}
  if(state.version!==1||!state.latest||!Array.isArray(state.history))fail('HARNESS_STATE_CORRUPT');
  return state;
}
export function mergeRun(state,record){
  const next=structuredClone(state),key=`${record.runId}:${record.attempt}`;
  // Detailed artifact links live in audit comments. Keep the issue state small
  // even when one workflow accumulates artifacts across many retry attempts.
  const metadata={...record,artifacts:[]};
  const old=next.latest[record.workflow];
  if(!old||Date.parse(record.completedAt)>Date.parse(old.completedAt)||(record.runId===old.runId&&record.attempt>=old.attempt))next.latest[record.workflow]=metadata;
  next.history=next.history.filter(r=>`${r.runId}:${r.attempt}`!==key);
  next.history.push(metadata);next.history.sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt));next.history=next.history.slice(0,40);
  return next;
}
export function harnessOperationalSummary(state){
 const blockers=Object.values(state.latest||{}).filter(r=>['failure','timed_out','action_required','startup_failure'].includes(r.conclusion)).map(r=>({source:r.workflow,code:r.conclusion,url:r.url}));
 if(state.deployment&&state.deployment.status!=='VERIFIED_EXACT_REVISION_AND_GMAIL')blockers.unshift({source:'Vercel / Gmail',code:state.deployment.code||state.deployment.status});
 return {status:blockers.length?'ATTENTION_REQUIRED':'NO_RECORDED_FAILURES',blockers,autonomousCodeRepair:false,scope:'Automatic observation, diagnosis and durable reporting; supervised implementation and commercial execution remain separate'};
}
export function renderIssue(state,at){
  const rows=Object.entries(TRACKED).map(([file,scope])=>{
    const r=state.latest[file];
    return r?`| ${scope} | ${r.conclusion} | ${r.sha.slice(0,7)} | [${r.runId}, intento ${r.attempt}](${r.url}) | ${r.completedAt} |`:`| ${scope} | SIN_EVIDENCIA | — | — | — |`;
  }).join('\n');
  const summary=harnessOperationalSummary(state);
  const attention=`Estado operativo observado: **${summary.status}**. ${summary.blockers.map(b=>`${b.source}: ${b.code}`).join('; ')}.\n\nEl harness observa y registra automáticamente; no modifica código ni renueva credenciales OAuth por sí solo.\n\n`;
  const deployment=state.deployment?`Vercel: **${state.deployment.status}**. Commit esperado: ${state.deployment.expectedCommit}; commit leído: ${state.deployment.deploymentCommit||'N/D'}; Gmail verificado: ${state.deployment.gmailVerified===true}; comprobado: ${state.deployment.at}. Alcance: revisión exacta y lectura OAuth, sin envío comercial.\n\n`:'';
  return `${MARKER}\n\n# Harness: registro automático de verificaciones\n\nActualizado automáticamente: ${at}. Rama observada: main.\n\n${attention}${deployment}Cada fila describe el resultado de un workflow, no una certificación funcional. success no demuestra Gmail operativo, entrega, autonomía comercial, venta ni cobro sin consultar los recibos. Los artifacts pueden caducar; se conserva el resultado de ejecución y los recibos procesados en comentarios. Las pruebas locales/supervisadas no se detectan automáticamente: deben registrarse por separado.\n\n| Comprobación | Resultado del workflow | Commit | Evidencia | Fecha UTC |\n|---|---|---|---|---|\n${rows}\n\nSe reconstruyen los últimos resultados de todos los workflows vigilados al procesar cada aviso, para recuperar avisos agrupados por concurrencia. No es un ledger exhaustivo de cada ejecución histórica.\n\nEstado producido por workflow_run, deployment_status, push de configuración o ejecución manual. No reescribe reglas, no aprueba código, no envía correos y no activa campañas ni pagos.\n\n<!-- HARNESS_STATE\n${JSON.stringify(state)}\nHARNESS_STATE -->`;
}
export async function updateHarness({api,repository,eventName,event,deploymentProbe,at=new Date().toISOString()}){
  if(repository!=='Rick2818/Boltech-Group')fail('HARNESS_REPOSITORY_DENIED');
  const prefix=`/repos/${repository}`;
  if(eventName==='workflow_run'&&!normalizeRun(event.workflow_run,repository))return {status:'IGNORED_UNTRUSTED_OR_UNTRACKED_EVENT'};
  if(eventName==='deployment_status'&&(!['production','Production'].includes(event.deployment?.environment)||event.repository?.full_name!==repository))return {status:'IGNORED_NON_PRODUCTION_DEPLOYMENT'};
  if(!['workflow_run','push','workflow_dispatch','deployment_status'].includes(eventName))fail('HARNESS_EVENT_DENIED');
  const issue=await api('GET',`${prefix}/issues/${HARNESS_ISSUE}`);
  let state=readState(issue.body);const records=[];
  // Bootstrap and periodic config changes rebuild current main metadata without
  // executing another workflow, downloading artifacts, or reading secret APIs.
  if(eventName==='workflow_run')records.push(normalizeRun(event.workflow_run,repository));
  {
    const workflows=await api('GET',`${prefix}/actions/workflows?per_page=100`);
    for(const workflow of workflows.workflows||[]){
      const file=workflow.path?.split('/').at(-1);if(!TRACKED[file])continue;
      const runs=await api('GET',`${prefix}/actions/workflows/${workflow.id}/runs?branch=main&status=completed&per_page=1`);
      const record=runs.workflow_runs?.[0]&&normalizeRun(runs.workflow_runs[0],repository);if(record&&!records.some(r=>r.runId===record.runId&&r.attempt===record.attempt))records.push(record);
    }
  }
  if(deploymentProbe){
    if(deploymentProbe.scope!=='VERCEL_READ_ONLY_PRODUCTION_PROBE'||!/^[a-f0-9]{40}$/i.test(deploymentProbe.expectedCommit||'')||!Number.isFinite(Date.parse(deploymentProbe.at))||!['VERIFIED_EXACT_REVISION_AND_GMAIL','FAILED'].includes(deploymentProbe.status))fail('HARNESS_INVALID_DEPLOYMENT_PROBE');
    if(!state.deployment||Date.parse(deploymentProbe.at)>=Date.parse(state.deployment.at))state.deployment=deploymentProbe;
  }else if(eventName==='deployment_status'&&['error','failure'].includes(event.deployment_status?.state)){
    if(!/^[a-f0-9]{40}$/i.test(event.deployment.sha||'')||!Number.isFinite(Date.parse(event.deployment_status.updated_at)))fail('HARNESS_INVALID_DEPLOYMENT_STATE');
    if(!state.deployment||event.deployment.sha===state.deployment.expectedCommit||Date.parse(event.deployment.created_at)>Date.parse(state.deployment.at))state.deployment={status:'VERCEL_EVENT_'+event.deployment_status.state.toUpperCase(),expectedCommit:event.deployment.sha,at:event.deployment_status.updated_at,gmailVerified:false};
  }
  for(const record of records){
    const list=await api('GET',`${prefix}/actions/runs/${record.runId}/artifacts?per_page=100`);
    record.artifacts=(list.artifacts||[]).filter(a=>Number.isSafeInteger(a.id)&&a.id>0).map(a=>({id:a.id,expired:!!a.expired,url:`https://github.com/${repository}/actions/runs/${record.runId}/artifacts/${a.id}`}));
    state=mergeRun(state,record);
  }
  const body=renderIssue(state,at);
  await api('PATCH',`${prefix}/issues/${HARNESS_ISSUE}`,{body});
  if((await api('GET',`${prefix}/issues/${HARNESS_ISSUE}`)).body!==body)fail('HARNESS_ISSUE_READBACK_FAILED');
  // Each run/attempt has one durable audit comment. Scan all pages before any
  // mutation so a lost response or workflow retry cannot duplicate a comment.
  const existing=[];let page=1;
  while(true){const rows=await api('GET',`${prefix}/issues/${HARNESS_ISSUE}/comments?per_page=100&page=${page}`);existing.push(...rows);if(rows.length<100)break;if(++page>50)fail('HARNESS_HISTORY_REVIEW_REQUIRED');}
  let added=0;
  for(const r of records){
    const marker=`<!-- harness-run:${r.runId}:${r.attempt} -->`;
    if(existing.some(c=>c.body?.includes(marker)))continue;
    const links=r.artifacts.map(a=>`[artifact ${a.id}](${a.url})${a.expired?' (caducado)':''}`).join(' · ')||'Sin artifact asociado';
    const text=`${marker}\n\n**${r.scope}**: workflow **${r.conclusion}**.\n\nCommit: ${r.sha}; rama main; intento ${r.attempt}; fecha ${r.completedAt}.\n\n[Recibo de ejecución](${r.url}) · ${links}\n\nAlcance: resultado técnico del workflow; no infiere envío, entrega, venta, pago ni autonomía.`;
    const saved=await api('POST',`${prefix}/issues/${HARNESS_ISSUE}/comments`,{body:text});
    if(saved.body!==text)fail('HARNESS_COMMENT_READBACK_FAILED');existing.push(saved);added++;
  }
  return {status:'UPDATED_AND_READBACK_VERIFIED',issue:HARNESS_ISSUE,at,tracked:Object.keys(state.latest).length,newComments:added,operationalSummary:harnessOperationalSummary(state),state,markdown:body};
}

import crypto from 'node:crypto';
import pilot from '../config/commercial_pilot.json' with { type: 'json' };
import followups from '../config/rsi01_followups.json' with { type: 'json' };

export const MARKETING_SUPPORT_VERSION = 1;
const roles = new Set(['RSI-01', 'RSI-02', 'RSI-03']);
const clean = value => typeof value === 'string' && value.length <= 250 && !/[\x00-\x1f]/.test(value);

// Produces private sales enablement, never sends, publishes, invents customer facts or changes terms.
export function buildMarketingSupport(packet) {
  if (!roles.has(packet?.rsi) || !Array.isArray(packet.accounts) || packet.accounts.length > 5) throw Object.assign(new Error('MARKETING_INVALID_INPUT'), { code: 'MARKETING_INVALID_INPUT' });
  const rsi = packet.rsi;
  const es = rsi === 'RSI-01' ? {
    subject: 'Seguimiento de solicitudes en su empresa',
    text: 'Hola. En Boltech Group trabajamos con agentes preelaborados y a medida para procedimientos empresariales. Estamos evaluando un caso concreto: registrar cada solicitud, asignar un responsable y dejar visible el próximo paso. ¿Cómo lleva su equipo ese seguimiento hoy? Puede responder por este correo con el paso que quiere mejorar. Evaluaremos el encaje antes de proponer una solución.',
    cta: 'Describa por este correo cómo recibe y da seguimiento a las solicitudes.'
  } : rsi === 'RSI-02' ? {
    questions: ['¿Qué ocurre paso a paso desde que llega una solicitud?', '¿Cuántas reciben y qué tiempo o trabajo les exige?', '¿Qué herramientas y datos utilizan?', '¿Quién interviene y qué decisiones requieren aprobación?', '¿Qué resultado medible indicaría que se resolvió?', '¿Qué nunca debe hacer el agente?'],
    demonstrationChecklist: ['Acordar permiso y datos para la demostración.', 'Mostrar registro, referencia, responsable y próxima acción dentro del alcance validado.', 'Comprobar duplicado, dato incompleto y fallo de integración.', 'Registrar resultado y límites; solicitar confirmación escrita del encaje.'],
    cta: 'Responda estas preguntas para preparar un alcance individual.'
  } : {
    offer: `${pilot.name}: USD${pilot.implementationAmount}, ${pilot.durationDays} días para el piloto delimitado; USD${pilot.milestones[0].amount} tras aceptación de alcance y accesos, USD${pilot.milestones[1].amount} contra entrega verificada.`,
    scope: 'Una empresa, un flujo web y una integración simple. Consumo de herramientas, mantenimiento e integraciones adicionales se cotizan aparte.',
    objections: ['Si ya usa una hoja o CRM: revisar el paso manual que necesita mejorar antes de añadir otra herramienta.', 'Si pregunta por resultados: acordar una prueba y criterios medibles del procedimiento.', 'Si pregunta por otro agente: evaluar su caso y cotizarlo individualmente.'],
    cta: 'Confirme por escrito el alcance propuesto; validaremos accesos y costos antes de iniciar.'
  };
  const en = rsi === 'RSI-01' ? {
    subject: 'Tracking incoming requests',
    text: 'Hello. Boltech Group works with prebuilt and custom agents for business workflows. We are evaluating a specific use case: recording each request, assigning an owner and keeping the next action visible. How does your team track this today? Reply with the step you want to improve. We will assess fit before proposing a solution.',
    cta: 'Reply with how your team receives and follows up on requests.'
  } : rsi === 'RSI-02' ? {
    questions: ['What happens from receipt through resolution?', 'What volume, time or manual work is involved?', 'Which tools and data do you use?', 'Who participates and what requires human approval?', 'What measurable outcome would demonstrate success?', 'What must the agent never do?'],
    demonstrationChecklist: ['Agree on permission and demonstration data.', 'Show registration, reference, owner and next action within validated scope.', 'Check duplicates, incomplete inputs and integration failure.', 'Record results and limitations; request written confirmation of fit.'],
    cta: 'Reply to these questions so we can define an individual scope.'
  } : {
    offer: `Request intake pilot: USD${pilot.implementationAmount}, ${pilot.durationDays} days for the defined scope; USD${pilot.milestones[0].amount} after scope acceptance and required access, USD${pilot.milestones[1].amount} after verified delivery.`,
    scope: 'One business, one web workflow and one simple integration. Tool usage, maintenance and additional integrations are separate.',
    objections: ['Existing spreadsheet or CRM: identify the manual step before adding a tool.', 'Results: agree on a test and measurable workflow acceptance criteria.', 'Other agent: assess and quote the case individually.'],
    cta: 'Confirm the proposed scope in writing; required access and costs must be verified before starting.'
  };
  // The existing individually authorized follow-up is the material sales will actually use.
  // Do not substitute this text into other accounts or expand its sending authorization.
  const followup = rsi === 'RSI-01' && packet.accounts.length === 1 && followups.enabled
    ? followups.accounts.find(a=>a.recordId===packet.accounts[0].sourceRecordId) : null;
  if(followup){es.text=followup.text;es.cta='Responda por el mismo correo con el paso manual que necesita mejorar.';}
  const requests = packet.accounts.map(a => {
    if (!clean(a.sourceRecordId) || !clean(a.account) || !clean(a.route)) throw Object.assign(new Error('MARKETING_INVALID_INPUT'), { code: 'MARKETING_INVALID_INPUT' });
    return { requestId: `marketing:${rsi}:${a.sourceRecordId}`, sourceRecordId: a.sourceRecordId, account: a.account,
      requestedBy: rsi, owner: 'marketing-director', route: a.route,
      priority: a.route === 'QUALIFY_CUSTOMER_REPLY' ? (rsi === 'RSI-03' ? 1 : 2) : 3,
      need: rsi === 'RSI-01' ? 'MESSAGE_AND_FIT' : rsi === 'RSI-02' ? 'WRITTEN_DIAGNOSIS_AND_DEMONSTRATION' : 'SCOPE_VALUE_AND_OBJECTIONS',
      status: 'MATERIAL_PREPARED_REQUIRES_SALES_REVIEW', due: 'CURRENT_EXISTING_SALES_CYCLE',
      gates: [...(a.gates || []), 'SALES_MATERIAL_ACCEPTANCE', ...(rsi === 'RSI-03' ? ['CUSTOMER_CONFIRMED_PROBLEM', 'DOCUMENTED_COSTS', 'SCOPE_ACCEPTANCE'] : [])],
      salesAcceptance: 'UNCONFIRMED', commercialResult: 'UNCONFIRMED' };
  }).sort((a,b)=>a.priority-b.priority || a.requestId.localeCompare(b.requestId));
  const support = { version: MARKETING_SUPPORT_VERSION, owner: 'marketing-director', requestedBy:rsi,
    mode:'PRIVATE_SALES_SUPPORT', requests, materials:{es,en}, offerVersion:pilot.offerVersion,
    delivery:'EXISTING_RSI_BOOTSTRAP_EVIDENCE', publicPublishingEnabled:false, sendingEnabled:false,
    demoExecuted:false, saleVerified:false,
    nextAction:'Sales reviews the material, selects the customer language, applies current contact/technical permissions and records acceptance, use and commercial outcome in existing CRM notes.' };
  if(followup) support.authorizedFollowup={originalMessageId:followup.originalMessageId,dueAt:followup.dueAt,expiresAt:followup.expiresAt,authorization:followups.authorization,language:'es'};
  return {...support,fingerprint:crypto.createHash('sha256').update(JSON.stringify(support)).digest('hex')};
}

export function mergeMarketingSupport(evidence, support) {
  const begin='[MARKETING_SALES_SUPPORT_V1]', end='[/MARKETING_SALES_SUPPORT_V1]';
  const original=typeof evidence==='string'?evidence:'';
  const start=original.indexOf(begin),finish=original.indexOf(end,start);
  if(start>=0 && finish<start) throw Object.assign(new Error('MARKETING_EVIDENCE_RECONCILE_REQUIRED'),{code:'MARKETING_EVIDENCE_RECONCILE_REQUIRED'});
  // Human acceptance/outcome notes are kept outside this replaceable generated block.
  const block=`${begin}\n${JSON.stringify(support)}\n${end}`;
  return start>=0 ? original.slice(0,start)+block+original.slice(finish+end.length) : `${original}${original?'\n\n':''}${block}`;
}

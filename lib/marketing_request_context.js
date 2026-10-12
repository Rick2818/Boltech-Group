import crypto from 'node:crypto';
const fail=code=>{throw Object.assign(Error(code),{code,statusCode:409});};
const safe=(s,max=2000)=>typeof s==='string'&&s.trim()&&s.length<=max&&!/[\x00-\x1f]/.test(s);
export function contextualizeMarketing(material,request){
 if(!request)return material;
 if(!safe(request.need)||!safe(request.deliverable)||!['SUPPLIER_FIT','MESSAGE_AND_FIT','WRITTEN_DIAGNOSIS_AND_DEMONSTRATION','SCOPE_VALUE_AND_OBJECTIONS'].includes(request.kind))fail('MARKETING_SPECIFIC_BRIEF_REQUIRED');
 const context={kind:request.kind,need:request.need.trim(),deliverable:request.deliverable.trim(),evidenceRefs:request.evidenceRefs||[]};
 if(!Array.isArray(context.evidenceRefs)||context.evidenceRefs.length>10||context.evidenceRefs.some(s=>!safe(s,500)))fail('MARKETING_CONTEXT_EVIDENCE_INVALID');
 const byKind={
 SUPPLIER_FIT:{es:{subject:'Encaje como proveedor para el proyecto',questions:['¿Aceptan un proveedor por proyecto o requieren contratación individual?','¿Existe un proyecto financiado disponible y cuál es su alcance?','¿Qué herramientas, resultado y fecha requiere?','¿Es obligatorio un portafolio de implementaciones externas?'],cta:'Confirme encaje, proyecto disponible y requisitos antes de cotizar.'},en:{subject:'Supplier fit for the project',questions:['Do you accept a project supplier or require an individual contractor?','Is a funded project available and what is its scope?','Which tools, outcome and deadline are required?','Is an external client implementation portfolio mandatory?'],cta:'Confirm supplier fit, available project and requirements before quoting.'}},
 MESSAGE_AND_FIT:{es:{questions:['¿Qué paso del proceso indicado necesita mejorar?','¿Quién decide y qué resultado espera?'],cta:'Validar hechos e historial antes de preparar contacto individual.'},en:{questions:['Which step of the stated process needs improvement?','Who decides and what outcome is expected?'],cta:'Validate facts and history before preparing individual contact.'}},
 WRITTEN_DIAGNOSIS_AND_DEMONSTRATION:{es:{questions:['¿Cuál es el proceso actual y su pérdida medible?','¿Qué datos y accesos están autorizados?','¿Qué criterio y muestra permiten verificar la solución?'],cta:'Completar diagnóstico por escrito antes de preparar demostración.'},en:{questions:['What is the current process and measurable loss?','Which data and access are authorized?','Which criterion and sample can verify the solution?'],cta:'Complete written diagnosis before preparing a demonstration.'}},
 SCOPE_VALUE_AND_OBJECTIONS:{es:{questions:['¿Qué objeción concreta impide la decisión?','¿Qué alcance, precio y condiciones tienen aprobación vigente?'],cta:'Responder con condiciones aprobadas; escalar cualquier cambio.'},en:{questions:['Which specific objection prevents a decision?','Which scope, price and terms have current approval?'],cta:'Respond using approved terms; escalate any change.'}}
 };
 const next={...material,version:2,context,materials:Object.fromEntries(Object.entries(byKind[context.kind]).map(([lang,value])=>[lang,{...value,brief:(lang==='es'?'Necesidad registrada: ':'Recorded need: ')+context.need+' / '+(lang==='es'?'Entregable solicitado: ':'Requested deliverable: ')+context.deliverable}])),quality:{status:'CONTEXT_BOUND_PRIVATE_BRIEF',checks:['SPECIFIC_NEED','REQUESTED_DELIVERABLE','ROLE_PURPOSE'],externalClaimsVerified:false},salesReviewRequired:true,sendingEnabled:false,publicPublishingEnabled:false};
 delete next.fingerprint;return {...next,fingerprint:crypto.createHash('sha256').update(JSON.stringify(next)).digest('hex')};
}
export function marketingDisposition(row,account){
 const f=account?.fields||{};
 if(!account||account.id!==row.opportunityId)fail('MARKETING_ACCOUNT_UNVERIFIED');
 if(row.marketingUse)return {state:row.marketingResult?'RESULT_VERIFIED':'WAITING_CUSTOMER_REPLY',owner:row.from,reason:'Preserve verified use and original thread; no repeated send.'};
 if(f['Data Quality']==='QA'||f.Unsubscribed||f['Do Not Contact']||/bounced|unsubscribed|disqualified/i.test([f.Status,f['Commercial Stage'],f.Notes].join(' ')))return {state:'CONTACT_HOLD',owner:row.from,reason:'Excluded or suppressed account; no external use.'};
 if(row.material?.version!==2||!row.material.context)return {state:'NEEDS_SPECIFIC_BRIEF',owner:row.from,reason:'Existing generic material requires a specific need and requested deliverable.'};
 if(row.from!=='RSI-01'&&!/Replied|Proposal sent|Won unpaid/.test(f['Commercial Stage']||''))return {state:'WAITING_QUALIFIED_REPLY',owner:row.from,reason:'Diagnosis or closure support waits for a verified human reply and qualification.'};
 if(!row.marketingReview||row.marketingReview.materialFingerprint!==row.material.fingerprint)return {state:'NEEDS_SALES_REVIEW',owner:row.from,reason:'Review the corrected context and evidence before use.'};
 if(/Contacted|WAITING_RESPONSE/i.test(f['Commercial Stage']||'')||/\bSENT\b/.test(f.Notes||''))return {state:'WAITING_CUSTOMER_REPLY',owner:row.from,reason:'Existing contact found; keep original thread and do not send again.'};
 return {state:'READY_FOR_AUTHORIZED_SALES_DECISION',owner:row.from,reason:'Material reviewed; current channel, history and individual authorization remain required.'};
}

export function marketingRequestFromEvent(event){
 if(event.supportRequest)return event.supportRequest;
 if(!event.need||!event.deliverable)return undefined;
 const kind=event.from==='RSI-02'?'WRITTEN_DIAGNOSIS_AND_DEMONSTRATION':event.from==='RSI-03'?'SCOPE_VALUE_AND_OBJECTIONS':/supplier|proveedor|portfolio|portafolio/i.test(event.need)?'SUPPLIER_FIT':'MESSAGE_AND_FIT';
 return {kind,need:event.need,deliverable:event.deliverable,evidenceRefs:[event.opportunityId]};
}

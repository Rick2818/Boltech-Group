export function routeSalesMarketingEvent(event) {
  const fail=code=>({success:false,code,httpStatus:400});
  const text=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  if(!event || !text(event.eventId) || !text(event.opportunityId) || !['RSI-01','RSI-02','RSI-03'].includes(event.from)) return fail('INVALID_AGENT_EVENT');
  if(!['SUPPORT_REQUEST','PROBLEM','CLOSE_REPORTED'].includes(event.type))return fail('INVALID_EVENT_TYPE');
  if(event.type==='CLOSE_REPORTED') {
    if(event.from!=='RSI-03'||!text(event.evidenceRef))return fail('CLOSURE_EVIDENCE_REQUIRED');
    return {success:true,eventId:event.eventId,opportunityId:event.opportunityId,from:'RSI-03',to:'DIRECTORA',
      status:'CLOSE_REPORTED_REQUIRES_DIRECTOR_VERIFICATION',evidenceRef:event.evidenceRef,
      next:'Directora verifica aceptación, alcance y evidencia de pago del proveedor; después informa a Ricardo.',
      notificationChain:['RSI-03','DIRECTORA','RICARDO'],ricardoNotified:false,paymentVerified:false,saleCounted:false};
  }
  const attempt=event.attempt??0;
  if(!Number.isInteger(attempt)||attempt<0||attempt>3)return fail('INVALID_ATTEMPT');
  const alternatives={
    NO_RESPONSE:['REVIEW_FIT_AND_HISTORY','REFRAME_ONE_SPECIFIC_PROBLEM','WRITTEN_FOLLOWUP_WITH_EXISTING_THREAD'],
    MISSING_DATA:['RESEARCH_PUBLISHED_BUSINESS_SOURCE','REQUEST_MINIMUM_DATA_IN_WRITING','PREPARE_REDUCED_SCOPE_PENDING_VALIDATION'],
    DEMO_UNAVAILABLE:['PROVIDE_WRITTEN_PROCESS_WALKTHROUGH','USE_EXISTING_VERIFIED_RECORDING','REQUEST_TECHNICAL_VALIDATION'],
    PRICE_OBJECTION:['CLARIFY_APPROVED_SCOPE_AND_VALUE','EVALUATE_SMALLER_SCOPE_FOR_DIRECTOR_APPROVAL','ESCALATE_PRICING_DECISION'],
    TOOL_FAILURE:['CHECK_STATUS_WITH_READ_ONLY_REQUEST','USE_LOCAL_PRIVATE_MATERIAL_AND_KEEP_PENDING_SYNC','ESCALATE_TECHNICAL_FAILURE'],
    SEND_UNKNOWN:['RECONCILE_PROVIDER_RECEIPT_WITHOUT_RESENDING'],
    BOUNCED:['SUPPRESS_FAILED_ADDRESS','RESEARCH_ALTERNATIVE_PUBLISHED_BUSINESS_CHANNEL'],
    SUPPORT_NEEDED:['PREPARE_ROLE_SPECIFIC_MATERIAL','CLARIFY_THE_SALES_BLOCKER','ESCALATE_WITH_EVIDENCE']
  };
  const problem=event.problem??'SUPPORT_NEEDED';
  if(!Object.hasOwn(alternatives,problem))return fail('UNKNOWN_PROBLEM');
  const choices=alternatives[problem],action=choices[Math.min(attempt,choices.length-1)];
  const approval=['EVALUATE_SMALLER_SCOPE_FOR_DIRECTOR_APPROVAL','ESCALATE_PRICING_DECISION','ESCALATE_WITH_EVIDENCE','ESCALATE_TECHNICAL_FAILURE','REQUEST_TECHNICAL_VALIDATION'].includes(action)||attempt===3;
  return {success:true,eventId:event.eventId,opportunityId:event.opportunityId,from:event.from,to:approval?'DIRECTORA':'marketing-director',returnTo:event.from,
    problem,attempt,action,status:approval?'DIRECTOR_DECISION_REQUIRED':'SUPPORT_PREPARED_REQUIRES_SALES_VALIDATION',
    nextAttemptAllowed:!approval&&attempt<choices.length-1,externalSendingAllowed:false,
    priceChangeAllowed:false,newSpendAllowed:false,credentialChangeAllowed:false,paymentVerified:false,saleCounted:false,
    next:'Registrar resultado en notas existentes del CRM. Si la alternativa falla, conservar eventId nuevo y referenciar el anterior; máximo tres alternativas y luego Dirección.'};
}

// Event-driven, first-party commercial executor. No network, billing or outbound dispatch.
// Executed within the same Cloudflare Pages Worker and encrypted COMMERCE namespace.
const executionJSON=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export const commercialExecutionPlan=(record)=>{
 const need=String(record?.need||'').trim().slice(0,1000);
 const company=String(record?.company||'').trim().slice(0,120);
 if(!need||!company)throw Error('EXECUTION_INPUT_INCOMPLETE');
 const qualified=!!(record.qualification?.budget&&record.qualification?.timeline&&record.qualification?.decisionMaker);
 const proposalApproved=record.proposal?.status==='OWNER_APPROVED';
 return {
  engine:'LEO_COMMERCIAL_EXECUTOR_V1',type:'INTERNAL_ONLY',
  createdAt:new Date().toISOString(),
  requires:['CONFIRM_CUSTOMER_IDENTITY','VERIFY_CONTACT_CONSENT','REVIEW_SCOPE_AND_QUOTE','VERIFY_PAYMENT_SEPARATELY','VERIFY_CHANNEL_BEFORE_DELIVERY'],
  qualification:{
   status:qualified?'READY_FOR_OWNER_REVIEW':'INCOMPLETE',
   missing:qualified?[]:['budget','timeline','decisionMaker']
  },
  proposalDraft:{
   status:qualified?'READY_TO_PRICE':'WAITING_FOR_QUALIFICATION',
   scopeSummary:need,exclusions:'No incluye cobros, promesas de inventario, envíos ni canales sin autorización.',
   amountCents:record.proposal?.amountCents??null,
   automaticPriceApproval:false
  },
  followupDraft:{
   status:proposalApproved?'READY_FOR_OWNER_REVIEW':'WAITING_FOR_APPROVED_PROPOSAL',
   channel:'INTERNAL',
   text:'Gracias por contactar a Boltech. Para continuar con '+company+', confirmemos el alcance acordado y los requisitos pendientes. Este es un borrador interno, no un mensaje enviado.',
   dispatched:false
  },
  afterSales:{
   status:record.closure?.outcome==='WON'?'PAYMENT_AND_CHANNEL_VERIFICATION_REQUIRED':'NOT_STARTED',
   realOrderId:null,agentActivated:false,channelConnected:false,customerAcceptanceVerified:false
  },
  authorizedExternalActions:[]
 };
};
export async function handleLeoExecution(request,env,{ownerRequest,authorize,seal,unseal,onboarding}){
 if(request.method!=='POST')return executionJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return executionJSON({success:false,error:'ORIGIN_NOT_ALLOWED'},403);
 if(!env.COMMERCE?.get||!env.COMMERCE?.put||typeof env.LEO_PLATFORM_TOKEN!=='string'||env.LEO_PLATFORM_TOKEN.length<24)
  return executionJSON({success:false,error:'EXECUTOR_UNAVAILABLE'},503);
 const authorized=await ownerRequest(request,env);
 if(authorized instanceof Response)return authorized;
 if(!authorize(authorized,env))return executionJSON({success:false,error:'OWNER_ACCESS_REQUIRED'},401);
 try{
  if(Number(request.headers.get('Content-Length'))>2000)return executionJSON({success:false,error:'INVALID_INPUT'},400);
  const raw=await request.text();if(raw.length>2000)return executionJSON({success:false,error:'INVALID_INPUT'},400);
  let data;try{data=JSON.parse(raw);}catch{return executionJSON({success:false,error:'INVALID_INPUT'},400);}
  if(!['prepare','prepare_onboarding'].includes(data?.action)||typeof data?.id!=='string'||!/^[a-f0-9-]{36}$/.test(data.id))
   return executionJSON({success:false,error:'INVALID_INPUT'},400);
  const key='leo:commercial:v1:'+data.id,stored=await env.COMMERCE.get(key);
  if(!stored)return executionJSON({success:false,error:'NOT_FOUND'},404);
  const record=await unseal(stored,env,'commercial:'+data.id);
  if(!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion!==record.version)
   return executionJSON({success:false,error:'STALE_VERSION',currentVersion:record.version},409);
  if(record.mode!=='REAL_UNVERIFIED_INQUIRY'&&record.mode!=='REAL_INTERNAL_RECORD')
   return executionJSON({success:false,error:'INVALID_RECORD_MODE'},403);
  if(data.action==='prepare_onboarding'){
   if(record.closure?.outcome!=='WON'||record.proposal?.status!=='OWNER_APPROVED'||data.confirmed!==true)
    return executionJSON({success:false,error:'APPROVED_CLOSURE_REQUIRED'},409);
   if(record.afterSalesInvitation)return executionJSON({success:false,error:'ONBOARDING_ALREADY_PREPARED'},409);
   if(typeof onboarding!=='function')return executionJSON({success:false,error:'ONBOARDING_NOT_CONFIGURED'},503);
   // A configuration invitation is NOT an order, proof of payment or an activated agent.
   const orderId='LEO_'+record.id.replaceAll('-','');
   const setupURL=new URL('/api/customer-setup?action=invite',request.url);
   const headers=new Headers(authorized.headers);headers.set('Origin',new URL(request.url).origin);
   headers.set('Content-Type','application/json');
   const invitationResponse=await onboarding(new Request(setupURL,{method:'POST',headers,
    body:JSON.stringify({orderId,mode:'CUSTOMER'})}),env,{ownerRequest,authorize,seal,unseal});
   if(!invitationResponse.ok)return executionJSON({success:false,error:'ONBOARDING_INVITATION_FAILED'},503);
   const invitation=await invitationResponse.json();
   if(!invitation?.success||typeof invitation.url!=='string')return executionJSON({success:false,error:'ONBOARDING_INVITATION_FAILED'},503);
   record.afterSalesInvitation={orderId,issuedAt:new Date().toISOString(),expiresAt:invitation.expiresAt,
    scope:'KNOWLEDGE_CONFIGURATION_ONLY',paymentVerified:false,channelConnected:false,agentActivated:false,
    deliveryAccepted:false,externalInvitationSent:false};
   record.version++;record.updatedAt=new Date().toISOString();
   await env.COMMERCE.put(key,await seal(record,env,'commercial:'+data.id));
   // The private URL is returned once to the authenticated owner. It is never sent automatically.
   return executionJSON({success:true,mode:'CONFIGURATION_INVITATION_PREPARED_NOT_SENT',
    recordVersion:record.version,invitationUrl:invitation.url,afterSales:record.afterSalesInvitation});
  }
  // This is an actual persisted execution receipt, not a third-party dispatch receipt.
  const plan=commercialExecutionPlan(record);
  record.commercialExecution={...plan,receiptId:crypto.randomUUID(),persisted:true};
  record.version++;record.updatedAt=new Date().toISOString();
  await env.COMMERCE.put(key,await seal(record,env,'commercial:'+data.id));
  return executionJSON({success:true,receiptId:record.commercialExecution.receiptId,
    recordVersion:record.version,execution:record.commercialExecution,mode:'INTERNAL_EXECUTED_NO_OUTBOUND'});
 }catch{return executionJSON({success:false,error:'EXECUTOR_UNAVAILABLE'},503);}
}

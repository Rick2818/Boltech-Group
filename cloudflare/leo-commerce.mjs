// Owner-controlled commercial ledger. Records are real, outbound actions are deliberately absent.
// Cloudflare KV is eventually consistent: this workflow rejects stale versions but is not a transaction engine.
const commerceJSON=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const short=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const validMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000; // cents
async function inputBody(request){
 if(Number(request.headers.get('Content-Length'))>16000)throw Error('BODY_TOO_LARGE');
 const raw=await request.text();if(raw.length>16000)throw Error('BODY_TOO_LARGE');
 try {const data=JSON.parse(raw);if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return data;}
 catch{throw Error('INVALID_INPUT');}
}
export async function handleLeoCommerce(request,env,{ownerRequest,authorize,seal,unseal}){
 if(!['GET','POST'].includes(request.method))return commerceJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==new URL(request.url).origin)return commerceJSON({success:false,error:'ORIGIN_NOT_ALLOWED'},403);
 if(!env.COMMERCE?.get||!env.COMMERCE?.put||typeof env.LEO_PLATFORM_TOKEN!=='string'||env.LEO_PLATFORM_TOKEN.length<24)
  return commerceJSON({success:false,error:'LEDGER_STORAGE_UNAVAILABLE'},503);
 const owner=await ownerRequest(request,env);
 if(owner instanceof Response)return owner;
 if(!authorize(owner,env))return commerceJSON({success:false,error:'OWNER_ACCESS_REQUIRED'},401);
 try{
  const url=new URL(request.url),data=request.method==='POST'?await inputBody(request):{};
  const action=request.method==='GET'?'read':short(data.action,30);
  if(!['create','read','qualify','proposal','approve','followup','close'].includes(action))
   return commerceJSON({success:false,error:'ACTION_NOT_ALLOWED'},400);
  const id=action==='read'?url.searchParams.get('id'):data.id;
  if(action!=='create'&&!validId(id))return commerceJSON({success:false,error:'INVALID_ID'},400);
  const key='leo:commercial:v1:'+id;
  if(action==='create'){
   const company=short(data.company,120),contact=short(data.contact,120),need=short(data.need,1500);
   if(!company||!contact||!need||data.synthetic===true)return commerceJSON({success:false,error:'REAL_CUSTOMER_DETAILS_REQUIRED'},400);
   const newId=crypto.randomUUID(),now=new Date().toISOString();
   const rec={id:newId,version:1,company,contact,need,source:short(data.source,120),status:'NEW',qualification:null,proposal:null,followups:[],closure:null,createdAt:now,updatedAt:now,mode:'REAL_INTERNAL_RECORD',externalMessagesSent:0,paymentVerified:false};
   await env.COMMERCE.put('leo:commercial:v1:'+newId,await seal(rec,env,'commercial:'+newId));
   return commerceJSON({success:true,record:rec},201);
  }
  const raw=await env.COMMERCE.get(key);
  if(!raw)return commerceJSON({success:false,error:'NOT_FOUND'},404);
  const rec=await unseal(raw,env,'commercial:'+id);
  if(action==='read')return commerceJSON({success:true,record:rec});
  if(!Number.isSafeInteger(data.expectedVersion)||rec.version!==data.expectedVersion)
   return commerceJSON({success:false,error:'STALE_VERSION',currentVersion:rec.version},409);
  if(rec.closure)return commerceJSON({success:false,error:'ALREADY_CLOSED'},409);
  const now=new Date().toISOString();
  if(action==='qualify'){
   const budget=short(data.budget,120),timeline=short(data.timeline,120),decisionMaker=short(data.decisionMaker,120);
   if(!budget||!timeline||!decisionMaker)return commerceJSON({success:false,error:'QUALIFICATION_INCOMPLETE'},400);
   rec.qualification={budget,timeline,decisionMaker,completedAt:now};rec.status='QUALIFIED';
  }else if(action==='proposal'){
   if(!rec.qualification)return commerceJSON({success:false,error:'QUALIFICATION_REQUIRED'},409);
   const scope=short(data.scope,3000),exclusions=short(data.exclusions,1000);
   if(!scope||!exclusions||!validMoney(data.amountCents)||data.amountCents===0)
    return commerceJSON({success:false,error:'PROPOSAL_INCOMPLETE'},400);
   rec.proposal={scope,exclusions,amountCents:data.amountCents,currency:'USD',status:'DRAFT',approvedAt:null,createdAt:now,externalSent:false};
   rec.status='PROPOSAL_DRAFT';
  }else if(action==='approve'){
   if(!rec.proposal||rec.proposal.status!=='DRAFT'||data.confirmed!==true)
    return commerceJSON({success:false,error:'DRAFT_APPROVAL_REQUIRED'},409);
   rec.proposal.status='OWNER_APPROVED';rec.proposal.approvedAt=now;rec.status='PROPOSAL_APPROVED';
  }else if(action==='followup'){
   if(!rec.proposal||rec.proposal.status!=='OWNER_APPROVED')
    return commerceJSON({success:false,error:'APPROVED_PROPOSAL_REQUIRED'},409);
   const note=short(data.note,1200),channel=short(data.channel,40);
   if(!note||!['MANUAL_EMAIL','MANUAL_PHONE','MANUAL_WHATSAPP','INTERNAL'].includes(channel)||rec.followups.length>=50)
    return commerceJSON({success:false,error:'FOLLOWUP_INVALID'},400);
   if(data.sent===true&&!short(data.evidence,300))return commerceJSON({success:false,error:'SEND_EVIDENCE_REQUIRED'},400);
   rec.followups.push({id:crypto.randomUUID(),note,channel,status:data.sent===true?'MANUALLY_REPORTED_SENT':'DRAFT_NOT_SENT',evidence:data.sent===true?short(data.evidence,300):null,recordedAt:now});
   rec.status='FOLLOWUP';
  }else if(action==='close'){
   if(!rec.proposal||rec.proposal.status!=='OWNER_APPROVED'||data.confirmed!==true)
    return commerceJSON({success:false,error:'APPROVED_PROPOSAL_REQUIRED'},409);
   const outcome=short(data.outcome,20),evidence=short(data.evidence,500);
   if(!['WON','LOST'].includes(outcome)||!evidence)return commerceJSON({success:false,error:'CLOSURE_EVIDENCE_REQUIRED'},400);
   if(outcome==='WON'&&data.customerAccepted!==true)return commerceJSON({success:false,error:'CUSTOMER_ACCEPTANCE_REQUIRED'},409);
   rec.closure={outcome,evidence,recordedAt:now,customerAcceptanceRecorded:outcome==='WON'};
   rec.status=outcome==='WON'?'CLOSED_WON_REPORTED':'CLOSED_LOST';
  }
  rec.version++;rec.updatedAt=now;
  // The KV write is an auditable internal record, not proof of an external provider action.
  await env.COMMERCE.put(key,await seal(rec,env,'commercial:'+id));
  return commerceJSON({success:true,record:rec});
 }catch(error){
  const code=['BODY_TOO_LARGE','INVALID_INPUT'].includes(error.message)?error.message:'LEDGER_UNAVAILABLE';
  return commerceJSON({success:false,error:code},code==='BODY_TOO_LARGE'?413:code==='INVALID_INPUT'?400:503);
 }
}

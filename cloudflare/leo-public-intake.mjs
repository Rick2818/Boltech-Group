// Public opt-in lead intake for Leo. Stores a real, unverified inquiry without executing outreach.
const intakeJSON=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'}});
const intakeText=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export async function handleLeoPublicIntake(request,env,{seal}){
 if(request.method!=='POST')return intakeJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
 const origin=new URL(request.url).origin;
 if(request.headers.get('Origin')!==origin || ['cross-site'].includes(request.headers.get('Sec-Fetch-Site')))
  return intakeJSON({success:false,error:'ORIGIN_NOT_ALLOWED'},403);
 if(!env.COMMERCE?.put||!env.COMMERCE?.get||typeof env.LEO_PLATFORM_TOKEN!=='string'||env.LEO_PLATFORM_TOKEN.length<24)
  return intakeJSON({success:false,error:'INTAKE_UNAVAILABLE'},503);
 try{
  if(Number(request.headers.get('Content-Length'))>6000)return intakeJSON({success:false,error:'REQUEST_TOO_LARGE'},413);
  const raw=await request.text();if(raw.length>6000)return intakeJSON({success:false,error:'REQUEST_TOO_LARGE'},413);
  let data;try{data=JSON.parse(raw);}catch{return intakeJSON({success:false,error:'INVALID_INPUT'},400);}
  if(!data||typeof data!=='object'||Array.isArray(data))return intakeJSON({success:false,error:'INVALID_INPUT'},400);
  // Explicit affirmative opt-in on the form. A chatbot utterance alone is not consent.
  if(data.consent!==true||data.synthetic===true||data.website!=='')return intakeJSON({success:false,error:'CONSENT_OR_VALIDATION_REQUIRED'},400);
  const company=intakeText(data.company,120),contact=intakeText(data.contact,120),need=intakeText(data.need,1000),email=intakeText(data.email,254);
  if(!company||!contact||need.length<12||!/^\S+@\S+\.\S+$/.test(email)||/[\r\n]/.test(email)||company.length>120||contact.length>120)
   return intakeJSON({success:false,error:'INVALID_CUSTOMER_DETAILS'},400);
  // Soft anti-spam; not a guarantee of atomic rate-limiting on eventually-consistent KV.
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const fp=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(origin+'|'+ip+'|'+email.toLowerCase()));
  const hash=Array.from(new Uint8Array(fp)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const limitKey='leo:intake:cooldown:'+hash;
  if(await env.COMMERCE.get(limitKey))return intakeJSON({success:false,error:'INTAKE_RECENTLY_RECEIVED'},429);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  const record={id,version:1,company,contact,need,email,source:'LEO_PUBLIC_OPT_IN',status:'NEW_UNVERIFIED',qualification:null,proposal:null,followups:[],closure:null,
   createdAt:now,updatedAt:now,mode:'REAL_UNVERIFIED_INQUIRY',consent:{purpose:'QUOTE_REQUEST',recordedAt:now,channel:'WEB',externalFollowupAuthorized:false},
   externalMessagesSent:0,paymentVerified:false};
  await env.COMMERCE.put('leo:commercial:v1:'+id,await seal(record,env,'commercial:'+id));
  await env.COMMERCE.put(limitKey,'1',{expirationTtl:600});
  // No email, contact name or internal access token is returned to an anonymous client.
  return intakeJSON({success:true,reference:id,status:'RECEIVED_UNVERIFIED',externalMessagesSent:0},201);
 }catch{return intakeJSON({success:false,error:'INTAKE_UNAVAILABLE'},503);}
}

import {validateCustomerOnboarding} from '../lib/customer_onboarding.js';
const setupJSON=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const setupHash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const setupNormalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
async function setupInput(request){
 if(Number(request.headers.get('Content-Length'))>24000)throw Error('SETUP_TOO_LARGE');
 const reader=request.body?.getReader();if(!reader)throw Error('SETUP_INVALID_INPUT');
 let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>24000)throw Error('SETUP_TOO_LARGE');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('SETUP_INVALID_INPUT');}
}
export async function handleCustomerSetup(request,env,{ownerRequest,authorize,seal,unseal}){
 const url=new URL(request.url),action=url.searchParams.get('action')||'status';
 const ready=!!(env.COMMERCE?.get&&env.COMMERCE?.put&&typeof env.LEO_PLATFORM_TOKEN==='string'&&env.LEO_PLATFORM_TOKEN.length>=24);
 if(action==='status'&&request.method==='GET')return setupJSON({success:true,configured:ready,release:'customer-setup-20261111-v1',agentActivationAutomatic:false});
 if(!['GET','POST'].includes(request.method))return setupJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return setupJSON({success:false,error:'ORIGIN_NOT_ALLOWED'},403);
 if(!ready)return setupJSON({success:false,error:'CUSTOMER_SETUP_STORAGE_UNAVAILABLE'},503);
 try{
  if(['invite','approve'].includes(action)){
   const owner=await ownerRequest(request,env);if(owner instanceof Response)return owner;
   if(!authorize(owner,env))return setupJSON({success:false,error:'OWNER_ACCESS_REQUIRED'},401);
  }
  if(action==='invite'&&request.method==='POST'){
   const input=await setupInput(request);
   if(typeof input.orderId!=='string'||!/^[A-Za-z0-9_-]{3,100}$/.test(input.orderId)||!['SYNTHETIC_ONLY','CUSTOMER'].includes(input.mode))throw Error('SETUP_INVALID_INPUT');
   const record={id:crypto.randomUUID(),orderId:input.orderId,mode:input.mode,createdAt:Date.now(),expiresAt:Date.now()+7*86400000};
   const access=await seal(record,env,'customer-setup-access');
   await env.COMMERCE.put('customer:setup:invite:'+record.id,JSON.stringify(record),{expirationTtl:604800});
   return setupJSON({success:true,url:url.origin+'/customer-setup#access='+access,orderId:record.orderId,expiresAt:record.expiresAt},201);
  }
  // A client link is a scoped, expiring capability. It never authenticates as owner.
  const bearer=request.headers.get('X-Setup-Access')||request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!bearer)return setupJSON({success:false,error:'CUSTOMER_LINK_REQUIRED'},401);
  let access;try{access=await unseal(bearer,env,'customer-setup-access');}catch{return setupJSON({success:false,error:'CUSTOMER_LINK_INVALID'},401);}
  if(!/^[a-f0-9-]{36}$/.test(access.id||'')||!Number.isFinite(access.expiresAt)||access.expiresAt<=Date.now()||access.expiresAt>Date.now()+7*86400000)return setupJSON({success:false,error:'CUSTOMER_LINK_EXPIRED'},401);
  const invitation=await env.COMMERCE.get('customer:setup:invite:'+access.id);
  if(!invitation||invitation!==JSON.stringify(access))return setupJSON({success:false,error:'CUSTOMER_LINK_INVALID'},401);
  const base='customer:setup:'+access.id+':';
  const load=async key=>{const raw=await env.COMMERCE.get(base+key);return raw?await unseal(raw,env,'customer-setup-record:'+access.id):null;};
  const save=async(key,value)=>env.COMMERCE.put(base+key,await seal(value,env,'customer-setup-record:'+access.id),{expirationTtl:2592000});
  if(action==='read'&&request.method==='GET'){
   const latest=await load('latest'),approved=await load('approved'),accepted=await load('accepted');
   return setupJSON({success:true,orderId:access.orderId,mode:access.mode,latest,approved,accepted,agentActivated:false});
  }
  if(request.method!=='POST')return setupJSON({success:false,error:'METHOD_NOT_ALLOWED'},405);
  const input=await setupInput(request);
  if(action==='submit'){
   const result=validateCustomerOnboarding(input);if(!result.valid)return setupJSON({success:false,error:'CUSTOMER_CONFIGURATION_INVALID',errors:result.errors},400);
   const configuration={...result.configuration,orderId:access.orderId,mode:access.mode};
   const revision=await setupHash(JSON.stringify(configuration));
   const record={revision,configuration};await save('revision:'+revision,record);await save('latest',record);
   return setupJSON({success:true,revision,status:configuration.status,orderId:access.orderId,agentActivated:false},201);
  }
  if(action==='approve'){
   if(!/^[a-f0-9]{64}$/.test(input.revision||''))throw Error('SETUP_INVALID_INPUT');
   const record=await load('revision:'+input.revision);if(!record)return setupJSON({success:false,error:'CONFIGURATION_NOT_FOUND'},404);
   const approved={revision:record.revision,reviewedAt:new Date().toISOString(),status:'APPROVED_FOR_SUPERVISED_TEST',agentActivated:false};
   await save('approved',approved);return setupJSON({success:true,...approved});
  }
  if(action==='preview'){
   const latest=await load('latest');if(!latest)return setupJSON({success:false,error:'CONFIGURATION_NOT_FOUND'},404);
   if(typeof input.message!=='string'||!input.message.trim()||input.message.length>1000)throw Error('SETUP_INVALID_INPUT');
   const config=latest.configuration,query=setupNormalize(input.message);
   let reply='No tengo ese dato confirmado. La consulta debe pasar a '+config.contact+'.';
   const faq=config.faqs.find(f=>setupNormalize(f.question)===query);
   if(faq)reply=faq.answer;
   else if(/\b(horario|abren|cierran)\b/.test(query)&&config.hours)reply=config.hours;
   else {
    const matches=config.catalog.filter(p=>setupNormalize(p.name)===query||p.sku&&setupNormalize(p.sku)===query);
    if(matches.length===1){const p=matches[0];reply=p.name+'. '+p.description+(p.priceUsd===null?' Precio pendiente de confirmar.':' Precio de referencia: US$'+p.priceUsd.toFixed(2)+'.')+(p.availability?' Disponibilidad indicada: '+p.availability+'.':' Disponibilidad pendiente de confirmar.')+' No se ha confirmado una reserva, venta ni cobro.';}
   }
   return setupJSON({success:true,reply,revision:latest.revision,mode:'KNOWLEDGE_PREVIEW_RULES',modelInference:false,externalMessageSent:false});
  }
  if(action==='accept'){
   const approved=await load('approved');
   if(!approved||input.revision!==approved.revision)return setupJSON({success:false,error:'APPROVED_REVISION_REQUIRED'},409);
   if(input.confirmed!==true)throw Error('SETUP_INVALID_INPUT');
   const accepted={revision:approved.revision,acceptedAt:new Date().toISOString(),status:'CONFIGURATION_ACCEPTED',scope:'KNOWLEDGE_CONFIGURATION_ONLY',agentActivated:false,paymentVerified:false};
   await save('accepted',accepted);return setupJSON({success:true,...accepted});
  }
  return setupJSON({success:false,error:'ACTION_NOT_ALLOWED'},400);
 }catch(error){
  const code=['SETUP_TOO_LARGE','SETUP_INVALID_INPUT'].includes(error.message)?error.message:'CUSTOMER_SETUP_UNAVAILABLE';
  return setupJSON({success:false,error:code},code==='SETUP_TOO_LARGE'?413:code==='SETUP_INVALID_INPUT'?400:503);
 }
}

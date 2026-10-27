// Leo is a factory product, NOT Boltech internal Agent 1.
// Tenant identity and authorization must come from a verified server principal.
// This module is a bounded orchestrator. No side effects or outreach without approved tools.
import crypto from 'node:crypto';
const fail=(code)=>{throw Object.assign(new Error(code),{code});};
const safeId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{3,100}$/.test(v);
const clean=v=>String(v??'').trim().slice(0,1200);
const checksum=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function createLeoTenantAgent({store,principal,tools={},clock=()=>new Date().toISOString()}={}){
 if(!store||typeof store.read!=='function'||typeof store.writeIfVersion!=='function')fail('LEO_STORE_REQUIRED');
 if(!principal?.verified||!safeId(principal.tenantId)||!safeId(principal.subject))fail('LEO_VERIFIED_PRINCIPAL_REQUIRED');
 const key=id=>{if(!safeId(id))fail('LEO_INVALID_OBJECTIVE_ID');return 'leo:v1:'+principal.tenantId+':'+id;};
 const get=async id=>{const data=await store.read(key(id));if(data&&data.tenantId!==principal.tenantId)fail('LEO_TENANT_VIOLATION');if(data&&data.owner!==principal.subject&&!principal.roles?.includes('tenant_admin'))fail('LEO_ACCESS_DENIED');return data;};
 async function objective({id,description,criteria,source='customer'}={}){
  const target=key(id),desc=clean(description),accept=clean(criteria);
  if(!principal.roles?.some(role=>['tenant_admin','tenant_operator'].includes(role)))fail('LEO_CREATE_PERMISSION_REQUIRED');
  if(desc.length<10||accept.length<5)fail('LEO_OBJECTIVE_INVALID');
  const record={schemaVersion:1,id,tenantId:principal.tenantId,owner:principal.subject,description:desc,criteria:accept,source,status:'AWAITING_PLAN_APPROVAL',version:1,createdAt:clock(),updatedAt:clock(),plan:[],events:[{kind:'CREATED',at:clock()}],fingerprint:checksum({desc,accept})};
  const saved=await store.writeIfVersion(target,null,record);
  if(!saved){const existing=await get(id);if(existing?.fingerprint!==record.fingerprint)fail('LEO_OBJECTIVE_CONFLICT');return existing;}
  return record;
 }
 async function transition({id,expectedVersion,action,eventId,plan=[],toolName='',input={},approval=false}={}){
  const record=await get(id);
  if(!record)fail('LEO_OBJECTIVE_MISSING');
  if(record.owner!==principal.subject&&!principal.roles?.includes('tenant_admin'))fail('LEO_ACCESS_DENIED');
  if(!safeId(eventId))fail('LEO_EVENT_REQUIRED');
  if(record.events.some(x=>x.id===eventId))return record;
  if(record.version!==expectedVersion)fail('LEO_VERSION_CONFLICT');
  const next=structuredClone(record);
  if(action==='plan'){
   if(!['AWAITING_PLAN_APPROVAL','BLOCKED'].includes(next.status)||!Array.isArray(plan)||plan.length<1||plan.length>5||plan.some(p=>typeof p!=='string'||clean(p).length<5))fail('LEO_PLAN_INVALID');
   next.plan=plan.map(clean);next.status='AWAITING_PLAN_APPROVAL';
  }else if(action==='approve'){
   if(!approval||!next.plan.length||next.status!=='AWAITING_PLAN_APPROVAL')fail('LEO_APPROVAL_REQUIRED');
   next.status='READY';
  }else if(action==='execute'){
   if(next.status!=='READY'||!approval)fail('LEO_EXECUTION_NOT_AUTHORIZED');
   if(!Object.hasOwn(tools,toolName)||!tools[toolName]?.readOnly)fail('LEO_TOOL_NOT_APPROVED');
   // Read-only tools only. Operational writes, sending, purchases and external delivery have separate approval paths.
   const output=await tools[toolName].run({tenantId:principal.tenantId,subject:principal.subject,input});
   if(!output?.receipt||!output?.ok)fail('LEO_TOOL_RECEIPT_REQUIRED');
   next.lastTool={name:toolName,receipt:clean(output.receipt),at:clock()};
   next.status='AWAITING_REVIEW';
  }else if(action==='complete'){
   if(next.status!=='AWAITING_REVIEW'||!approval||!next.lastTool?.receipt)fail('LEO_REVIEW_REQUIRED');
   next.status='COMPLETED';
  }else if(action==='block'){next.status='BLOCKED';}
  else fail('LEO_ACTION_FORBIDDEN');
  next.version++;next.updatedAt=clock();next.events.push({id:eventId,kind:action,at:clock()});
  if(next.events.length>80)fail('LEO_EVENT_LIMIT');
  if(!await store.writeIfVersion(key(id),record.version,next))fail('LEO_VERSION_CONFLICT');
  return next;
 }
 return {objective,transition,get};
}

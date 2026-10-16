// Mercadeo -> Airtable: write-ahead, verified CRM intake. Does not send email.
const BASE='https://api.airtable.com/v0/appCQZd0IhBHFoZ9P/tblZaox2MX5uYA5PZ';
const error=(code)=>{throw Object.assign(new Error(code),{code});};
const fields={name:'Name',email:'Contact Email',url:'Website',source:'Source',sourceUrl:'Source URL',notes:'Notes',stage:'Commercial Stage',owner:'Owner',evidence:'Lead Evidence'};
const fieldIDs={name:'fldJZPDSuCl9AYxwJ',email:'fldoJrBeutRTd85II',url:'fldpSaMVhh7HM6mFF',sourceUrl:'fld3FYF7kDPal9AaK',notes:'fldOWo2UXMDtrPkgg',stage:'fldM3UplbEfmWsPqK',owner:'fldIGhvzDtipXG43o',evidence:'fldOUhgJXDu1a8wqE',source:'fldviNYn008I5cQPG'};
const allowedSources=['Apollo','Lusha','Explee','Upwork','Website','Other'];
function normalize(raw){
 const name=String(raw?.company||'').trim().slice(0,180),email=String(raw?.email||'').trim().toLowerCase();
 const source=String(raw?.source||'').trim(),sourceUrl=String(raw?.sourceUrl||'').trim(),country=String(raw?.country||'').trim();
 if(!name||!allowedSources.includes(source)||!sourceUrl||!/^https:\/\//i.test(sourceUrl)||sourceUrl.length>1800)error('MARKETING_CRM_INVALID_SOURCE');
 if(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))error('MARKETING_CRM_INVALID_EMAIL');
 if(source==='Upwork'&&email)error('MARKETING_CRM_UPWORK_OFF_PLATFORM_BLOCKED');
 if(!email&&source!=='Upwork')error('MARKETING_CRM_EMAIL_REQUIRED');
 const contact=String(raw?.contact||'').trim().slice(0,160);
 return {name,email,source,sourceUrl,country,contact};
}
export function createMarketingCrmExecutor({fetcher=fetch,env=process.env}={}){
 async function api(path,init={}){
   if(!env.AIRTABLE_TOKEN)error('MARKETING_CRM_NOT_CONFIGURED');
   let response;try{response=await fetcher(BASE+path,{...init,headers:{Authorization:'Bearer '+env.AIRTABLE_TOKEN,'Content-Type':'application/json'},signal:AbortSignal.timeout(8000)});}catch{error('MARKETING_CRM_UNAVAILABLE');}
   if(!response.ok)error('MARKETING_CRM_UNAVAILABLE');
   try{return await response.json();}catch{error('MARKETING_CRM_INVALID_RECEIPT');}
 }
 const escapeFormula=s=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
 async function matches(p){
   const term=p.email?'{Contact Email}':"RECORD_ID()";
   // Filter by exact normalized email; platform-only Upwork posts use deterministic source URL.
   const filter=p.email?`LOWER({Contact Email})='${escapeFormula(p.email)}'`:`{Source URL}='${escapeFormula(p.sourceUrl)}'`;
   const query=new URLSearchParams({filterByFormula:filter,pageSize:'20'});
   const data=await api('?'+query);
   if(!Array.isArray(data.records))error('MARKETING_CRM_INVALID_RECEIPT');
   return data.records;
 }
 async function intake(input){
   const p=normalize(input);
   const found=await matches(p);
   if(found.length)return {success:true,created:false,recordId:found[0].id,duplicate:true,sendingAllowed:false,source:p.source};
   const details=`[MARKETING_SOURCE] ${JSON.stringify({platform:p.source,sourceUrl:p.sourceUrl,country:p.country,contact:p.contact,contactChannel:p.source==='Upwork'?'UPWORK_ONLY':'EMAIL_NOT_YET_AUTHORIZED',contactPermission:'UNCONFIRMED',nextAction:'RSI-01 VALIDATE BEFORE CONTACT'})}`;
   const f={[fieldIDs.name]:p.name,[fieldIDs.stage]:'Researching',[fieldIDs.evidence]:'RESEARCH_ONLY',[fieldIDs.owner]:'MARKETING -> RSI-01',[fieldIDs.notes]:details,[fieldIDs.sourceUrl]:p.sourceUrl,[fieldIDs.source]:'Other'};
   if(p.email)f[fieldIDs.email]=p.email;
   const created=await api('',{method:'POST',body:JSON.stringify({fields:f})});
   if(!/^rec[A-Za-z0-9]{14}$/.test(created?.id||''))error('MARKETING_CRM_CREATE_UNCONFIRMED');
   const verified=await api('/'+created.id);
   if(verified?.id!==created.id||verified?.fields?.[fields.name]!==p.name||String(verified?.fields?.[fields.email]||'').toLowerCase()!==p.email)error('MARKETING_CRM_VERIFY_FAILED');
   return {success:true,created:true,recordId:created.id,duplicate:false,sendingAllowed:false,source:p.source};
 }
 return {intake};
}

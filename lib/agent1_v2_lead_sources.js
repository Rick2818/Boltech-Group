import {createExpleeLiveSource} from './agent1_v2_explee_live.js';
import {createExpleeMcpSource} from './agent1_v2_explee_mcp.js';
import {readExpleeHistorical} from './agent1_v2_explee_historical.js';
// Three prospect sources for isolated Agent 1 V2.
// Connectors are injected: no credentials or autonomous sends in this module.
const clean=s=>String(s||'').trim();
export function createAgent1LeadSources({apollo,upwork,explee,expleeLiveConfig,expleeMcpConfig}={}){
 const expleeReader=explee||(expleeMcpConfig?createExpleeMcpSource(expleeMcpConfig):expleeLiveConfig?createExpleeLiveSource(expleeLiveConfig):()=>readExpleeHistorical());
 async function read(name,reader){
  if(typeof reader!=='function')return {source:name,status:'NOT_CONNECTED',candidates:[]};
  try{
   const data=await reader();
   if(!Array.isArray(data))return {source:name,status:'INVALID_RESPONSE',candidates:[]};
   return {source:name,status:'OBSERVED',candidates:data.slice(0,50).map(x=>({
    source:name,sourceId:clean(x.id),company:clean(x.company),
    title:clean(x.title),email:clean(x.email),sourceUrl:clean(x.sourceUrl),
    country:clean(x.country),clientCountry:clean(x.clientCountry),businessNeed:clean(x.businessNeed),
    contactVerified:x.contactVerified===true,buyerVerified:x.buyerVerified===true,
    contactEligible:false,sendAllowed:false
   }))};
  }catch{return {source:name,status:'CONNECTOR_UNAVAILABLE',candidates:[]};}
 }
 return {
  async discover(){
   const results=await Promise.all([read('APOLLO',apollo),read('UPWORK',upwork),read('EXPLEE',expleeReader)]);
   return {sources:results,observed:results.reduce((n,s)=>n+s.candidates.length,0),sendAllowed:false};
  }
 };
}
// Apollo saved contacts: do not assume a saved email is independently verified.
export function fromApolloContacts(response){
 const contacts=Array.isArray(response?.contacts)?response.contacts:[];
 return contacts.map(x=>({id:x.id,company:x.organization_name,title:x.title,email:x.email,
  sourceUrl:x.organization?.website_url||'',country:x.organization?.country||'',contactVerified:x.email_status==='verified',buyerVerified:false}));
}
// Upwork jobs are project opportunities, not verified mail contacts.
// They must be approached within Upwork under marketplace rules.
export function fromUpworkJobs(response){
 const jobs=Array.isArray(response?.jobs)?response.jobs:[];
 return jobs.map(x=>({id:x.id,company:x.client?.name||'',title:x.title,
  email:'',sourceUrl:x.url||'',country:x.client?.country||'',contactVerified:false,buyerVerified:false}));
}
// Explee: existing exports only until an official authenticated API is established.
export function fromExpleeExport(rows){
 if(!Array.isArray(rows))throw Error('EXPLEE_EXPORT_REQUIRED');
 return rows.map(x=>({id:x.id,company:x.company,title:x.title,email:x.email,
  sourceUrl:x.sourceUrl,country:x.country||'',contactVerified:false,buyerVerified:false}));
}

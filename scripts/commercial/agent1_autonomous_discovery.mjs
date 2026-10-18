import { writeFile, mkdir } from 'node:fs/promises';
import { createApolloClient } from '../../lib/apollo_client.js';
import { selectFiveLeads } from './agent1_lead_gate.mjs';
// Read-only prospect discovery. Provider names are not substitutes for access or verified buyers.
const sources={};const candidates=[];
async function source(name,enabled,fn){
 if(!enabled){sources[name]={status:'BLOCKED',reason:'CREDENTIALS_OR_APPROVED_CONNECTOR_MISSING'};return;}
 try{const found=await fn();sources[name]={status:'OBSERVED',candidates:found.length};candidates.push(...found);}
 catch(e){sources[name]={status:'BLOCKED',reason:String(e?.code||'PROVIDER_REQUEST_FAILED').slice(0,80)};}
}
const apolloConfigured=Boolean(process.env.APOLLO_API_KEY || process.env.BoltechVercelCRM);
await source('apollo',apolloConfigured,async()=>{
 const data=await createApolloClient().listSavedContacts({perPage:50,maxPages:2,budgetMs:25000});
 return data.contacts.map(x=>({...x,sourceVerified:true}));
});
await source('lusha',Boolean(process.env.LUSHA_API_KEY),async()=>{
  // Read-only, bounded search; returned records remain unqualified pending independent verification.
  const response=await fetch('https://api.lusha.com/prospecting/contact/search',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
    headers:{api_key:process.env.LUSHA_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({pages:{page:0,size:5},filters:{contacts:{include:{departments:['Operations']}}}})
  });
  if(!response.ok) throw Object.assign(new Error('LUSHA_HTTP_ERROR'),{code:'LUSHA_HTTP_'+response.status});
  const data=await response.json();
  const rows=Array.isArray(data.contacts)?data.contacts:Array.isArray(data.results)?data.results:[];
  return rows.slice(0,5).map(x=>({source:'LUSHA',sourceVerified:false,
    company:x.company?.name||x.companyName||'',name:x.name||'',title:x.title||'',contactEmail:x.email||'',
    domain:x.company?.domain||'',businessNeed:'',emailValidation:{mailboxConfirmed:false}}));
});
await source('upwork',false,async()=>[]); // Requires approved account/API; never scrape private pages
await source('n8n',false,async()=>[]); // Integration requires approved authenticated workflow contract
await source('internet',Boolean(process.env.TAVILY_API_KEY),async()=>{
  const response=await fetch('https://api.tavily.com/search',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
    headers:{Authorization:'Bearer '+process.env.TAVILY_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({query:'US B2B manufacturers manual quotation process automation',search_depth:'basic',max_results:5,include_answer:false})
  });
  if(!response.ok) throw Object.assign(new Error('WEB_SEARCH_HTTP_ERROR'),{code:'WEB_SEARCH_HTTP_'+response.status});
  const data=await response.json();
  // Search results are evidence leads to research, not contact or buyer records.
  return (Array.isArray(data.results)?data.results:[]).slice(0,5).map(x=>({
    source:'TAVILY_WEB',sourceUrl:x.url||'',company:'',name:'',title:'',contactEmail:'',
    domain:'',businessNeed:'',sourceVerified:false,emailValidation:{mailboxConfirmed:false}
  }));
});
const gate=selectFiveLeads(candidates);
const receipt={schema:'boltech.agent1.discovery.v1',timestamp:new Date().toISOString(),mode:'READ_ONLY',
 sources,observed:candidates.length,qualified:gate.accepted.length,missing:gate.missing,
 rejected:gate.rejected.length,nextAction:gate.nextAction,handoffPerformed:false,
 productionCertified:false,notice:'No send, enrichment purchase, or agent 2 handoff; unconfirmed buyer needs remain blocked.'};
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/agent1-discovery.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

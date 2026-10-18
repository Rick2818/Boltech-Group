import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createApolloClient } from '../../lib/apollo_client.js';
import { selectFiveLeads } from './agent1_lead_gate.mjs';
import { fetchN8nFreelanceOpportunities } from './agent1_n8n_community_jobs.mjs';
import { fetchUpworkFreelanceJobs } from '../../lib/upwork_mcp_client.js';
// Buyer contacts and freelance-work opportunities are separate read-only records.
const sources={};const candidates=[];const freelanceOpportunities=[];
const qaCase=JSON.parse(await readFile(new URL('../../config/qa_case.json',import.meta.url),'utf8'));
async function source(name,enabled,fn,disabledReason='CREDENTIALS_OR_APPROVED_CONNECTOR_MISSING'){
 if(!enabled){sources[name]={status:'BLOCKED',reason:disabledReason};return;}
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
try {
  const result=await fetchUpworkFreelanceJobs({qaCaseId:qaCase.id});
  sources.upwork={status:'OBSERVED',source:'OFFICIAL_UPWORK_MCP',auth:'OAUTH_2_1_MCP',adapter:'READ_ONLY_JOB_SEARCH',toolName:result.toolName,candidates:result.opportunities.length};
  freelanceOpportunities.push(...result.opportunities);
} catch(e) {
  sources.upwork={status:'BLOCKED',source:'OFFICIAL_UPWORK_MCP',auth:'OAUTH_2_1_REQUIRED',reason:String(e?.code||'UPWORK_MCP_REQUEST_FAILED').slice(0,80)};
}
try {
  const result=await fetchN8nFreelanceOpportunities({qaCaseId:qaCase.id});
  sources.n8nCommunityJobs={status:'OBSERVED',source:'PUBLIC_N8N_COMMUNITY_JOBS',auth:'PUBLIC_READ_ONLY',
    fetchedTopics:result.fetchedTopics,candidates:result.opportunities.length};
  freelanceOpportunities.push(...result.opportunities);
} catch(e) {
  sources.n8nCommunityJobs={status:'BLOCKED',reason:String(e?.code||'N8N_COMMUNITY_REQUEST_FAILED').slice(0,80)};
}
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
const receipt={schema:'boltech.agent1.discovery.v2',timestamp:new Date().toISOString(),mode:'READ_ONLY',
 sources,observed:candidates.length,qualified:gate.accepted.length,missing:gate.missing,
 rejected:gate.rejected.length,nextAction:gate.nextAction,handoffPerformed:false,
 freelanceOpportunitySources:{n8nCommunityJobs:{status:sources.n8nCommunityJobs?.status||'NOT_OBSERVED'},upwork:{status:sources.upwork?.status||'NOT_OBSERVED',reason:sources.upwork?.reason||null}},
 freelanceOpportunities:freelanceOpportunities,
 proposalsSubmitted:false,externalMessagesSent:false,connectsUsed:0,
 productionCertified:false,notice:'Freelance opportunities are separate from buyer leads. No messages, proposals, purchases, Connects, or agent 2 handoff.'};
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/agent1-discovery.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

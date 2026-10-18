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
await source('apollo',Boolean(process.env.APOLLO_API_KEY),async()=>{
 const data=await createApolloClient().listSavedContacts({perPage:50,maxPages:2,budgetMs:25000});
 return data.contacts.map(x=>({...x,sourceVerified:true}));
});
await source('lusha',false,async()=>[]); // No supported authenticated search adapter yet
await source('upwork',false,async()=>[]); // Requires approved account/API; never scrape private pages
await source('n8n',false,async()=>[]); // Integration requires approved authenticated workflow contract
await source('internet',false,async()=>[]); // No evidence-bearing contact discovery feed configured
const gate=selectFiveLeads(candidates);
const receipt={schema:'boltech.agent1.discovery.v1',timestamp:new Date().toISOString(),mode:'READ_ONLY',
 sources,observed:candidates.length,qualified:gate.accepted.length,missing:gate.missing,
 rejected:gate.rejected.length,nextAction:gate.nextAction,handoffPerformed:false,
 productionCertified:false,notice:'No send, enrichment purchase, or agent 2 handoff; unconfirmed buyer needs remain blocked.'};
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/agent1-discovery.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

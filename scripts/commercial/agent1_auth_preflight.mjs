// Centralized credential preflight: presence only, never display credentials.
import { writeFile,mkdir } from 'node:fs/promises';
const present=x=>typeof x==='string'&&x.trim().length>0;
const has=(...keys)=>keys.some(k=>present(process.env[k]));
const validHttps=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const checks={
 apollo:{configured:has('APOLLO_API_KEY','BoltechVercelCRM'),adapter:'READ_ONLY'},
 lusha:{configured:has('LUSHA_API_KEY'),adapter:'READ_ONLY'},
 internet:{configured:has('TAVILY_API_KEY'),adapter:'READ_ONLY'},
 upwork:{configured:has('UPWORK_CLIENT_ID')&&has('UPWORK_CLIENT_SECRET')&&has('UPWORK_REFRESH_TOKEN'),adapter:'NOT_IMPLEMENTED'},
 n8n:{configured:has('N8N_MCP_URL')&&has('N8N_MCP_TOKEN')&&validHttps(process.env.N8N_MCP_URL),adapter:'NOT_IMPLEMENTED'}
};
const receipt={type:'AGENT1_AUTH_PREFLIGHT_V1',timestamp:new Date().toISOString(),checks,
 allProvidersReady:Object.values(checks).every(x=>x.configured&&x.adapter==='READ_ONLY'),liveAuthenticationTested:false};
await mkdir('ops-output',{recursive:true});await writeFile('ops-output/agent1-auth-preflight.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

// Centralized credential preflight: presence only, never display credentials.
import { writeFile,mkdir } from 'node:fs/promises';
const present=x=>typeof x==='string'&&x.trim().length>0;
const has=(...keys)=>keys.some(k=>present(process.env[k]));
const checks={
 apollo:{configured:has('APOLLO_API_KEY','BoltechVercelCRM'),adapter:'READ_ONLY'},
 lusha:{configured:has('LUSHA_API_KEY'),adapter:'READ_ONLY'},
 internet:{configured:has('TAVILY_API_KEY'),adapter:'READ_ONLY'},
 upwork:{configured:false,auth:'OFFICIAL_MCP_OAUTH_2_1_REQUIRED',endpoint:'https://mcp.upwork.com/mcp',adapter:'NOT_CONNECTED'},
 n8nCommunityJobs:{configured:true,auth:'PUBLIC_READ_ONLY',endpoint:'https://community.n8n.io/c/jobs/13.json?page=0',adapter:'READ_ONLY'}
};
const receipt={type:'AGENT1_AUTH_PREFLIGHT_V2',timestamp:new Date().toISOString(),checks,
 allProvidersReady:Object.values(checks).every(x=>x.configured&&x.adapter==='READ_ONLY'),liveAuthenticationTested:false};
await mkdir('ops-output',{recursive:true});await writeFile('ops-output/agent1-auth-preflight.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

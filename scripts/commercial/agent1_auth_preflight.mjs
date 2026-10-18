// Centralized credential preflight: presence only, never display credentials.
import { writeFile,mkdir } from 'node:fs/promises';
import { Redis } from '@upstash/redis';
import { UpworkMcpOAuthProvider } from '../../lib/upwork_mcp_oauth_provider.js';
const present=x=>typeof x==='string'&&x.trim().length>0;
const has=(...keys)=>keys.some(k=>present(process.env[k]));
const upworkSecretsConfigured=Boolean(present(process.env.UPSTASH_REDIS_REST_URL)&&present(process.env.UPSTASH_REDIS_REST_TOKEN)&&(process.env.UPWORK_MCP_VAULT_KEY||'').length>=32);
let upworkAuthorizationStored=false;
let upworkVaultStatus=upworkSecretsConfigured?'NOT_AUTHORIZED_OR_UNREADABLE':'RUNTIME_SECRETS_MISSING';
if(upworkSecretsConfigured) {
 try {
  const redis=new Redis({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN});
  const provider=new UpworkMcpOAuthProvider({redis,vaultKey:process.env.UPWORK_MCP_VAULT_KEY});
  upworkAuthorizationStored=await provider.hasStoredAuthorization();
  upworkVaultStatus=upworkAuthorizationStored?'OAUTH_SESSION_STORED':'OAUTH_SESSION_MISSING';
 } catch { upworkVaultStatus='OAUTH_VAULT_UNREADABLE'; }
}
const checks={
 apollo:{configured:has('APOLLO_API_KEY','BoltechVercelCRM'),adapter:'READ_ONLY'},
 lusha:{configured:has('LUSHA_API_KEY'),adapter:'READ_ONLY'},
 internet:{configured:has('TAVILY_API_KEY'),adapter:'READ_ONLY'},
 upwork:{configured:upworkSecretsConfigured,authorizationStored:upworkAuthorizationStored,vaultStatus:upworkVaultStatus,auth:'OFFICIAL_MCP_OAUTH_2_1_REQUIRED',endpoint:'https://mcp.upwork.com/mcp',adapter:'READ_ONLY_MCP',credential:'ENCRYPTED_UPSTASH_OAUTH_VAULT'},
 n8nCommunityJobs:{configured:true,auth:'PUBLIC_READ_ONLY',endpoint:'https://community.n8n.io/c/jobs/13.json?page=0',adapter:'READ_ONLY'}
};
const receipt={type:'AGENT1_AUTH_PREFLIGHT_V2',timestamp:new Date().toISOString(),checks,
 allProvidersReady:Object.values(checks).every(x=>x.configured&&['READ_ONLY','READ_ONLY_MCP'].includes(x.adapter))&&upworkAuthorizationStored,liveAuthenticationTested:false};
await mkdir('ops-output',{recursive:true});await writeFile('ops-output/agent1-auth-preflight.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
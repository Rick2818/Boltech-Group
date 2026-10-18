import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchUpworkFreelanceJobs, UPWORK_MCP_ENDPOINT } from '../lib/upwork_mcp_client.js';
const qaCase=JSON.parse(readFileSync(new URL('../config/qa_case.json',import.meta.url),'utf8'));

function mockClient(tools, result) {
  const calls=[];
  const client={
    async connect(transport){calls.push(['connect',transport]);},
    async listTools(){return {tools};},
    async callTool(args){calls.push(['callTool',args]);return result;},
    async close(){calls.push(['close']);}
  };
  return {calls,clientFactory:async ({endpoint,oauthProvider})=>({client,transport:{endpoint,oauthProvider,close(){}}})};
}

test('uses the official remote MCP endpoint and read-only job search tool only',async()=>{
  const mock=mockClient([
    {name:'search_jobs',annotations:{readOnlyHint:true,destructiveHint:false},inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer'}},required:['query']}},
    {name:'submit_proposal',annotations:{readOnlyHint:false},inputSchema:{type:'object',properties:{jobId:{type:'string'}}}}
  ],{content:[{type:'text',text:JSON.stringify({jobs:[qaCase]})}]});
  const oauthProvider={testProvider:true};
  const result=await fetchUpworkFreelanceJobs({oauthProvider,limit:99,qaCaseId:qaCase.id,clientFactory:mock.clientFactory});
  assert.equal(result.toolName,'search_jobs');
  assert.equal(result.opportunities.length,0,'the sole QA fixture must never be treated as a freelance opportunity');
  assert.equal(mock.calls[0][1].endpoint,UPWORK_MCP_ENDPOINT);
  assert.equal(mock.calls[0][1].oauthProvider,oauthProvider);
  assert.equal(mock.calls.find(x=>x[0]==='callTool')[1].name,'search_jobs');
  assert.deepEqual(mock.calls.find(x=>x[0]==='callTool')[1].arguments,{query:'AI agent automation n8n CRM integrations lead generation',limit:10});
});

test('does not call unannotated or mutating tools',async()=>{
  const mock=mockClient([
    {name:'search_jobs',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}},
    {name:'submit_job_proposal',annotations:{readOnlyHint:false},inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}}
  ],{content:[]});
  await assert.rejects(fetchUpworkFreelanceJobs({oauthProvider:{},clientFactory:mock.clientFactory}),{code:'UPWORK_MCP_READ_ONLY_JOB_SEARCH_TOOL_UNAVAILABLE'});
  assert.equal(mock.calls.some(x=>x[0]==='callTool'),false);
});

test('OAuth provider requires durable encrypted storage',async()=>{
  const {UpworkMcpOAuthProvider}=await import('../lib/upwork_mcp_oauth_provider.js');
  assert.throws(()=>new UpworkMcpOAuthProvider({redis:null,vaultKey:'x'.repeat(32)}),{code:'UPWORK_MCP_DURABLE_STORE_REQUIRED'});
  assert.throws(()=>new UpworkMcpOAuthProvider({redis:{get:async()=>null,set:async()=>true},vaultKey:'short'}),{code:'UPWORK_MCP_VAULT_KEY_REQUIRED'});
});

test('OAuth client registration and rotating tokens persist only as ciphertext',async()=>{
  const {UpworkMcpOAuthProvider,UPWORK_MCP_VAULT_KEY}=await import('../lib/upwork_mcp_oauth_provider.js');
  const records=new Map();
  const redis={async get(key){return records.get(key)||null;},async set(key,value){records.set(key,value);return 'OK';}};
  const provider=new UpworkMcpOAuthProvider({redis,vaultKey:'v'.repeat(40)});
  const clientInformation={client_id:'test-client',client_secret:'test-client-secret'};
  const tokens={access_token:'access-secret',refresh_token:'refresh-secret',token_type:'Bearer'};
  await provider.saveClientInformation(clientInformation);
  await provider.saveTokens(tokens);
  const stored=records.get(UPWORK_MCP_VAULT_KEY);
  assert.equal(JSON.stringify(stored).includes('access-secret'),false);
  assert.equal(JSON.stringify(stored).includes('test-client-secret'),false);
  assert.deepEqual(await provider.clientInformation(),clientInformation);
  assert.deepEqual(await provider.tokens(),tokens);
});

test('tool authorization errors are sanitized and client is closed',async()=>{
  const mock=mockClient([{name:'search_jobs',annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}}],{isError:true,content:[{type:'text',text:'secret details'}]});
  await assert.rejects(fetchUpworkFreelanceJobs({oauthProvider:{},clientFactory:mock.clientFactory}),{code:'UPWORK_MCP_TOOL_FAILED'});
  assert.ok(mock.calls.some(x=>x[0]==='close'));
});

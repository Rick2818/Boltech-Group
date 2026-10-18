import http from 'node:http';
import { Redis } from '@upstash/redis';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UpworkMcpOAuthProvider } from '../../lib/upwork_mcp_oauth_provider.js';
import { UPWORK_MCP_ENDPOINT } from '../../lib/upwork_mcp_client.js';

const redisUrl=process.env.UPSTASH_REDIS_REST_URL||'';
const redisToken=process.env.UPSTASH_REDIS_REST_TOKEN||'';
const vaultKey=process.env.UPWORK_MCP_VAULT_KEY||'';
if(!redisUrl||!redisToken||vaultKey.length<32) {
  console.error('UPWORK_MCP_AUTH_SETUP_BLOCKED: durable Upstash Redis and a 32+ character UPWORK_MCP_VAULT_KEY are required.');
  process.exit(2);
}

const callbackPort=Number(process.env.UPWORK_MCP_CALLBACK_PORT||8765);
const callbackUrl=`http://127.0.0.1:${callbackPort}/oauth/callback`;
const redis=new Redis({url:redisUrl,token:redisToken});
let authorizationUrl;
const provider=new UpworkMcpOAuthProvider({redis,vaultKey,redirectUrl:callbackUrl,onAuthorizationUrl:url=>{authorizationUrl=url;}});
const createClient=()=>({
  client:new Client({name:'boltech-agent1-upwork-readonly',version:'1.0.0'}),
  transport:new StreamableHTTPClientTransport(new URL(UPWORK_MCP_ENDPOINT),{authProvider:provider})
});

const {client,transport}=createClient();
try {
  await client.connect(transport);
  const listed=await client.listTools();
  console.log(JSON.stringify({status:'ALREADY_AUTHORIZED',endpoint:UPWORK_MCP_ENDPOINT,toolsDiscovered:(listed.tools||[]).length}));
  await client.close();
  process.exit(0);
} catch (error) {
  if (!authorizationUrl) {
    console.error(JSON.stringify({status:'AUTHORIZATION_START_FAILED',code:error?.code||'MCP_CONNECT_FAILED'}));
    process.exitCode=1;
    await client.close().catch(()=>{});
  }
}

if(authorizationUrl) {
  const expectedState=provider.currentState();
  let finished=false;
  const server=http.createServer(async(req,res)=>{
    if(req.method!=='GET'||new URL(req.url,'http://127.0.0.1').pathname!=='/oauth/callback') {res.writeHead(404).end();return;}
    const params=new URL(req.url,'http://127.0.0.1').searchParams;
    if(params.get('state')!==expectedState||!params.get('code')||params.has('error')) {
      res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'}).end('Upwork authorization was not completed. You may close this tab.');
      return;
    }
    try {
      await transport.finishAuth(params.get('code'));
      const verify=createClient();
      await verify.client.connect(verify.transport);
      const listed=await verify.client.listTools();
      await verify.client.close();
      finished=true;
      res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}).end('Upwork MCP authorized. Agent 1 will use only explicitly read-only job-search tools. You may close this tab.');
      console.log(JSON.stringify({status:'OAUTH_AUTHORIZED_MCP_HANDSHAKE_PASS',endpoint:UPWORK_MCP_ENDPOINT,toolsDiscovered:(listed.tools||[]).length,tokensPersisted:'ENCRYPTED_UPSTASH_REDIS'}));
      server.close();
    } catch (error) {
      res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}).end('Authorization could not be verified. Contact the Boltech operator.');
      console.error(JSON.stringify({status:'POST_AUTH_MCP_HANDSHAKE_FAILED',code:error?.code||'MCP_HANDSHAKE_FAILED'}));
      server.close();
      process.exitCode=1;
    }
  });
  server.listen(callbackPort,'127.0.0.1',()=>{
    console.log(`Authorize Agent 1 in your browser: ${authorizationUrl.href}`);
    console.log(`The callback returns only to ${callbackUrl}; keep this process running until verified.`);
  });
  const timeout=setTimeout(()=>server.close(()=>{if(!finished){console.error('UPWORK_MCP_AUTH_TIMEOUT');process.exitCode=1;}}),5*60*1000);
  timeout.unref();
}

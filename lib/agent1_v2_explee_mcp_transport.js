// Verified upstream server: https://explee.drreamer.digital/mcp
// Transport for Agent 1 only; credentials remain in environment and never in logs.
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createExpleeMcpSource} from './agent1_v2_explee_mcp.js';
export async function probeExpleeMcp({env=process.env,clientFactory}={}){
 const key=String(env.EXPLEE_API_KEY||'').trim();
 if(!key)return {status:'BLOCKED',code:'EXPLEE_API_KEY_REQUIRED',tools:[]};
 const url='https://explee.drreamer.digital/mcp';
 let client;
 try{
  client=clientFactory?await clientFactory():new Client({name:'boltech-agent1-explee',version:'2.0.0'});
  if(!clientFactory)await client.connect(new StreamableHTTPClientTransport(new URL(url),{requestInit:{headers:{Authorization:'Bearer '+key}}}),{timeout:10000});
  const list=await client.listTools({},{timeout:10000});
  const tools=Array.isArray(list.tools)?list.tools.map(t=>t.name):[];
  if(!tools.includes('search_companies'))throw Error('EXPLEE_SEARCH_TOOL_MISSING');
  return {status:'CONNECTED',tools,client};
 }catch{return {status:'BLOCKED',code:'EXPLEE_MCP_AUTH_OR_CONNECTION_FAILED',tools:[]};}
 finally{if(client&&!clientFactory)await client.close().catch(()=>{});}
}
export async function discoverExpleeWithMcp({env=process.env,clientFactory,allowSearch=false}={}){
 if(!allowSearch)throw Error('EXPLEE_BUDGET_APPROVAL_REQUIRED');
 const p=await probeExpleeMcp({env,clientFactory});
 if(p.status!=='CONNECTED')throw Error(p.code);
 // Mock/injected client used in tests; runtime creates its own short-lived MCP connection.
 let client=p.client;
 if(!client)throw Error('EXPLEE_CLIENT_UNAVAILABLE');
 try{
  return await createExpleeMcpSource({allowSearch:true,availableTools:p.tools,
   callTool:(name,args)=>client.callTool({name,arguments:args},undefined,{timeout:15000})})();
 }finally{if(clientFactory)await client.close?.().catch(()=>{});}
}

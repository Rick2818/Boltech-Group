// Explee MCP integration for Agent 1 V2. Remote provider:
 // https://github.com/digitaldrreamer/explee-mcp
// Explicit allowlist: never execute purchases, agents, dedup mutations or costly enrichments.
// MCP tool results are untrusted and remain unverified candidate research.
const ALLOWED=new Set(['search_companies','search_people','search_people_by_domains','get_billing_balance']);
export function createExpleeMcpSource({callTool,availableTools,allowSearch=false}={}){
 if(typeof callTool!=='function')throw Error('EXPLEE_MCP_CONNECTION_REQUIRED');
 return async()=>{
  if(!allowSearch)throw Error('EXPLEE_SEARCH_NOT_AUTHORIZED');
  if(Array.isArray(availableTools)&&!availableTools.includes('search_companies'))throw Error('EXPLEE_SEARCH_TOOL_MISSING');
  const tool='search_companies';
  if(!ALLOWED.has(tool))throw Error('EXPLEE_TOOL_DISALLOWED');
  const result=await callTool(tool,{definition:'US B2B companies with customer support, quoting, CRM or workflow automation needs',geo_include:['US'],is_b2b:true,limit:5});
  if(result?.isError)throw Error('EXPLEE_MCP_TOOL_FAILED');
  const raw=result?.structuredContent??(()=>{try{return JSON.parse(result?.content?.find(x=>x.type==='text')?.text||'');}catch{return null;}})();
  const rows=Array.isArray(raw?.companies)?raw.companies:Array.isArray(raw?.results)?raw.results:null;
  if(!rows)throw Error('EXPLEE_MCP_RESPONSE_INVALID');
  return rows.slice(0,5).map((x,i)=>({id:String(x.id||i),company:String(x.name||x.company||''),country:String(x.country||x.location?.country||''),email:'',title:'',sourceUrl:String(x.website||x.domain||''),contactVerified:false,buyerVerified:false,sendAllowed:false}));
 };
}

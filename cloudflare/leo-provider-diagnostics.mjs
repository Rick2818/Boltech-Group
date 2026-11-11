// Account-only GET documented by Explee. Never searches, enriches or sends.
export async function expleeAccountCheck(env,fetchFn=fetch){
 const key=String(env.EXPLEE_API_KEY||'').trim();
 if(!key||/[\r\n]/.test(key))throw Error('PROVIDER_SECRET_MISSING');
 const response=await fetchFn('https://api.explee.com/public/api/v1/me',{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'X-API-Key':key,Accept:'application/json'}});
 const reader=response.body?.getReader();let raw='',size=0;const decoder=new TextDecoder();
 try{if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768)throw Error('PROVIDER_RESPONSE_INVALID');raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
 finally{await reader?.cancel().catch(()=>{});}
 let data;try{data=JSON.parse(raw);}catch{data=null;}
 if(!response.ok){
  const error=Error('PROVIDER_HTTP_'+response.status);
  const code=typeof data?.code==='string'?data.code:typeof data?.error==='string'?data.error:typeof data?.detail==='string'?data.detail:'';
  const value=code.toLowerCase().slice(0,400);
  error.providerReason=response.status===401||/invalid.{0,20}(api.?key|token)|revoked.{0,20}key/.test(value)?'API_KEY_REJECTED'
   :/ip.{0,20}(not.allowed|denied|restricted)|ip_allowlist/.test(value)?'IP_RESTRICTED'
   :/permission|scope|read.only|not.authorized/.test(value)?'API_SCOPE_DENIED'
   :response.headers.get('cf-mitigated')==='challenge'||(!data&&/cf-chl|cloudflare|error code:\s*10/i.test(raw))?'EDGE_ACCESS_DENIED'
   :response.status===429?'RATE_LIMITED':'ACCESS_DENIED_UNCLASSIFIED';
  throw error;
 }
 if(!data||typeof data.organization?.id!=='string'||!data.organization.id||!data.key||typeof data.key!=='object'||Array.isArray(data.key)||typeof data.balance?.remain!=='number'||!Number.isFinite(data.balance.remain)){
  const type=value=>value===undefined?'missing':value===null?'null':Array.isArray(value)?'array':typeof value;
  const error=Error('PROVIDER_RESPONSE_INVALID');error.providerReason='ACCOUNT_SCHEMA_MISMATCH';error.providerHttpStatus=response.status;
  // Fixed field names and primitive type labels only. Never emit values or keys
  // discovered in provider data, account identifiers, balances or raw responses.
  error.accountShape={body:type(data),organization:type(data?.organization),organizationId:type(data?.organization?.id),key:type(data?.key),balance:type(data?.balance),balanceRemain:type(data?.balance?.remain),data:type(data?.data),result:type(data?.result),organization_id:type(data?.organization_id),org:type(data?.org),org_id:type(data?.org_id),api_key:type(data?.api_key),jsonContentType:(response.headers.get('Content-Type')||'').includes('application/json')};
  throw error;
 }
 return {success:true,platform:'explee',status:'CONNECTED',checkedAt:new Date().toISOString(),mode:'READ_ONLY',accountCheck:'GET_ME',
  searchReadiness:data.balance.remain>0?'POSITIVE_BALANCE_NOT_SEARCH_VERIFIED':'POSITIVE_BALANCE_REQUIRED'};
}

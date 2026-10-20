// Read-only Explee API adapter. Does not invent a credential, contact or buyer.
// Requires a server-side key and an explicitly configured trusted API base.
export function createExpleeLiveSource({apiKey,baseUrl,fetcher=fetch}={}){
 const key=String(apiKey||'').trim();
 let endpoint;
 try{endpoint=new URL(baseUrl);}catch{throw Error('EXPLEE_API_ENDPOINT_UNVERIFIED');}
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('EXPLEE_API_ENDPOINT_UNVERIFIED');
 if(!key)throw Error('EXPLEE_API_KEY_REQUIRED');
 return async()=>{
  const response=await fetcher(new URL('companies/search',endpoint).href,{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({prompt:'US companies needing customer support, sales or workflow automation',limit:20,filters:{country:'US'}})
  });
  if(!response.ok)throw Error('EXPLEE_HTTP_'+response.status);
  const data=await response.json();
  const records=Array.isArray(data?.companies)?data.companies:Array.isArray(data?.results)?data.results:null;
  if(!records)throw Error('EXPLEE_RESPONSE_INVALID');
  return records.slice(0,20).map((x,i)=>({id:String(x.id||i),company:String(x.company||x.name||''),email:String(x.email||x.contactEmail||''),title:String(x.title||''),country:String(x.country||''),sourceUrl:String(x.website||x.url||''),contactVerified:false,buyerVerified:false}));
 };
}

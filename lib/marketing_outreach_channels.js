// Read-only provider connectors for Marketing Agent. No prospect import, campaign activation,
// LinkedIn personal-profile actions or outbound dispatch.
const deadline=ms=>AbortSignal.timeout(ms);
async function readProvider(url,token,fetcher,headers={}){
 const response=await fetcher(url,{method:'GET',redirect:'error',headers:{Accept:'application/json',...headers,Authorization:'Bearer '+token},signal:deadline(9000)});
 if(!response.ok)throw Error('PROVIDER_HTTP_'+response.status);
 return response.json();
}
const summary=(source,status,data={},code=null)=>({source,status,...data,...(code?{code}:{})});
export async function inspectWaalaxy({token=process.env.WAALAXY_API_KEY,fetcher=fetch}={}){
 if(!token)return summary('WAALAXY','BLOCKED',{},'WAALAXY_API_KEY_REQUIRED');
 try{
  const [lists,campaigns]=await Promise.all([
   readProvider('https://api.waalaxy.com/prospectLists/getProspectLists',token,fetcher),
   readProvider('https://api.waalaxy.com/campaigns/getAll',token,fetcher)]);
  const normalize=value=>Array.isArray(value)?value:Array.isArray(value?.data)?value.data:Array.isArray(value?.campaigns)?value.campaigns:Array.isArray(value?.prospectLists)?value.prospectLists:null;
  const a=normalize(lists),b=normalize(campaigns);
  if(!a||!b)return summary('WAALAXY','BLOCKED',{},'WAALAXY_RESPONSE_UNCONFIRMED');
  return summary('WAALAXY','VERIFIED_READ',{prospectLists:a.length,campaigns:b.length,importPerformed:false,outreachPerformed:false});
 }catch{return summary('WAALAXY','BLOCKED',{},'WAALAXY_API_UNAVAILABLE');}
}
export async function inspectInstantly({token=process.env.INSTANTLY_API_KEY,fetcher=fetch}={}){
 if(!token)return summary('INSTANTLY','BLOCKED',{},'INSTANTLY_API_KEY_REQUIRED');
 try{
  const [campaigns,accounts]=await Promise.all([
   readProvider('https://api.instantly.ai/api/v2/campaigns?limit=100',token,fetcher),
   readProvider('https://api.instantly.ai/api/v2/accounts?limit=100',token,fetcher)]);
  const normalize=value=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.data)?value.data:null;
  const a=normalize(campaigns),b=normalize(accounts);
  if(!a||!b)return summary('INSTANTLY','BLOCKED',{},'INSTANTLY_RESPONSE_UNCONFIRMED');
  return summary('INSTANTLY','VERIFIED_READ',{campaigns:a.length,senderAccounts:b.length,emailsSent:0,sendingPerformed:false});
 }catch{return summary('INSTANTLY','BLOCKED',{},'INSTANTLY_API_UNAVAILABLE');}
}
export async function inspectMarketingChannels(opts={}){
 const [waalaxy,instantly]=await Promise.all([inspectWaalaxy(opts.waalaxy||{}),inspectInstantly(opts.instantly||{})]);
 return {channels:[waalaxy,instantly],ready:waalaxy.status==='VERIFIED_READ'&&instantly.status==='VERIFIED_READ',sendingPerformed:false};
}

// Public-company evidence collection for RSI-01. Never validates a mailbox, buyer, or customer need.
import {isIP} from 'node:net';
export function safeCompanySite(value,contactEmail=''){
 try{
  const u=new URL(value),h=u.hostname.toLowerCase(),domain=String(contactEmail).split('@')[1]?.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(h)||h==='localhost'||!h.includes('.')||!domain)return null;
  if(h!==domain&&h!== 'www.'+domain)return null;
  if(/\.(local|internal|test|invalid|localhost)$/.test(h))return null;
  u.pathname='/';u.search='';u.hash='';return u.toString();
 }catch{return null}
}
export async function investigatePublicSite(lead,{fetcher=fetch}={}){
 const f=lead?.fields||{},url=safeCompanySite(f['Company URL'],f['Contact Email']);
 if(!url)return {state:'SOURCE_UNVERIFIED',reason:'DOMAIN_OR_URL_MISMATCH',approvalGranted:false};
 try{
  const response=await fetcher(url,{method:'GET',redirect:'error',headers:{Accept:'text/html'},signal:AbortSignal.timeout(5000)});
  if(!response.ok||!/text\/html/i.test(response.headers.get('content-type')||''))return {state:'SOURCE_UNVERIFIED',reason:'NO_PUBLIC_HTML',url,approvalGranted:false};
  const raw=(await response.text()).slice(0,60000);
  const title=raw.match(/<title[^>]*>([^<]{1,250})<\/title>/i)?.[1]?.replace(/\s+/g,' ').trim();
  if(!title)return {state:'SOURCE_UNVERIFIED',reason:'NO_PAGE_TITLE',url,approvalGranted:false};
  return {state:'PUBLIC_WEBSITE_OBSERVED',url,title,observedAt:new Date().toISOString(),approvalGranted:false,mailboxVerified:false,buyerVerified:false,needConfirmed:false};
 }catch{return {state:'SOURCE_UNVERIFIED',reason:'FETCH_FAILED',url,approvalGranted:false}}
}

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
export function operationalSignals(html=''){
 const content=String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').slice(0,60000);
 const patterns=[['QUOTE_INTAKE',/\b(?:request a quote|request for quote|quote request|get a quote|solicitar cotizaci[oó]n|cotizaciones)\b/i],['TECHNICAL_SPECIFICATIONS',/\b(?:upload (?:your )?(?:drawing|cad|file)|material thickness|annual usage|technical specifications|subir planos|especificaciones t[eé]cnicas)\b/i],['CUSTOMER_SUPPORT',/\b(?:customer support|support ticket|customer service|atenci[oó]n al cliente)\b/i]];
 return patterns.flatMap(([type,regex])=>{const match=regex.exec(content);return match?[{type,excerpt:content.slice(Math.max(0,match.index-70),Math.min(content.length,match.index+match[0].length+90)).trim()}]:[]});
}
// Bounded site search: public same-host pages only. No outbound or buyer inference.
export function discoverCompanyPages(html,base,limit=4){
 const root=new URL(base),paths=new Set();
 for(const m of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"'<>]{1,400})["']/gi)){
  try{
   const u=new URL(m[1],root);
   if(u.protocol!=='https:'||u.hostname!==root.hostname||u.port||u.username||u.password||u.search||u.hash)continue;
   if(!/(?:quote|contact|service|support|rfq|cotiz|solucion|about)/i.test(u.pathname))continue;
   if(/\.(?:pdf|jpg|png|zip|docx?)$/i.test(u.pathname)||u.pathname==='/')continue;
   paths.add(u.origin+u.pathname);
  }catch{}
 }
 return [...paths].sort().slice(0,limit);
}
export async function investigatePublicSite(lead,{fetcher=fetch}={}){
 const f=lead?.fields||{},url=safeCompanySite(f['Company URL'],f['Contact Email']);
 if(!url)return {state:'SOURCE_UNVERIFIED',reason:'DOMAIN_OR_URL_MISMATCH',approvalGranted:false};
 const get=async page=>{
  const response=await fetcher(page,{method:'GET',redirect:'error',headers:{Accept:'text/html'},signal:AbortSignal.timeout(5000)});
  if(!response.ok||!/text\/html/i.test(response.headers.get('content-type')||''))return null;
  return (await response.text()).slice(0,60000);
 };
 try{
  const raw=await get(url);
  if(!raw)return {state:'SOURCE_UNVERIFIED',reason:'NO_PUBLIC_HTML',url,approvalGranted:false};
  const title=raw.match(/<title[^>]*>([^<]{1,250})<\/title>/i)?.[1]?.replace(/\s+/g,' ').trim();
  if(!title)return {state:'SOURCE_UNVERIFIED',reason:'NO_PAGE_TITLE',url,approvalGranted:false};
  const contactEmail=String(f['Contact Email']||'').toLowerCase();
  const published=html=>String(html).toLowerCase().includes('mailto:'+contactEmail)||String(html).toLowerCase().includes('>'+contactEmail+'<');
  const sources=[{url,signals:operationalSignals(raw),contactPublished:published(raw)}];
  const declared=f['Source Evidence URL'];
  const pages=discoverCompanyPages(raw,url,3);
  try{const source=new URL(declared);if(source.protocol==='https:'&&source.hostname===new URL(url).hostname&&!source.port&&!source.username&&!source.password&&source.href!==url)pages.unshift(source.href);}catch{}
  for(const page of [...new Set(pages)].slice(0,3)){
   try{const html=await get(page);if(html)sources.push({url:page,signals:operationalSignals(html),contactPublished:published(html)});}catch{}
  }
  const operationalSignalsFound=sources.flatMap(x=>x.signals.map(signal=>({...signal,sourceUrl:x.url})));
  return {state:'PUBLIC_WEBSITE_OBSERVED',url,title,pagesInspected:sources.length,sources:sources.filter(x=>x.signals.length).slice(0,4),operationalSignals:operationalSignalsFound.slice(0,12),signalInterpretation:'PUBLIC_PROCESS_NOT_CUSTOMER_CONFIRMED_NEED',contactEvidence:sources.filter(x=>x.contactPublished).map(x=>({email:contactEmail,url:x.url,basis:'OFFICIAL_PUBLICATION'})),observedAt:new Date().toISOString(),approvalGranted:false,mailboxVerified:false,buyerVerified:false,needConfirmed:false};
 }catch{return {state:'SOURCE_UNVERIFIED',reason:'FETCH_FAILED',url,approvalGranted:false}}
}

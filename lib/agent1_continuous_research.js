import {createHash} from 'node:crypto';
import {resolveMx, resolve4} from 'node:dns/promises';

// Provider page sizes bound request cost, never the total research queue.
const states=['TX','OH','IL','MI','PA','CA','WI','MN','IN','IA','NC','TN','FL','GA','MO','NY','NJ','MA','CT','CO','AZ','OR','WA','SC','AL','KY','OK','KS','NE','AR','LA','MS','VA','MD','UT','NV','NH','ME','VT','RI','DE','WV','NM','ID','MT','WY','ND','SD','AK','HI'];
const segments=['custom metal fabrication and sheet metal manufacturing with request for quote workflow','precision CNC machining and contract manufacturing','industrial equipment distributors handling customer quote requests'];
const demandQueries=['need workflow automation','looking for help automating','manual quote process','customer request tracking'];
const digest=value=>createHash('sha256').update(value).digest('hex');
export function researchId(value){const h=digest(value);return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
const emailRe=/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const clean=value=>String(value||'').trim();
const plain=html=>html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi,' $1 ').replace(/<[^>]+>/g,' ').replace(/&#64;|&commat;/gi,'@').replace(/&#46;/g,'.').replace(/&nbsp;|\s+/g,' ');
const safeError=e=>String(e?.message||'RESEARCH_FAILED').replace(/https?:\/\/\S+/g,'[url]').slice(0,100);
const publicV4=ip=>{const [a,b]=ip.split('.').map(Number);return a>0&&a!==10&&a!==127&&a<224&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&b===168)&&!(a===100&&b>=64&&b<=127)&&!(a===198&&(b===18||b===19));};

export async function readOfficialPage(url,{fetcher=fetch,resolveAddresses=resolve4}={}){
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^[\d.]+$|:|\.local$|\.internal$/i.test(u.hostname))throw Error('PUBLIC_HTTPS_SOURCE_REQUIRED');
 const addresses=await resolveAddresses(u.hostname);
 if(!addresses.length||!addresses.every(publicV4))throw Error('PUBLIC_SOURCE_ADDRESS_REQUIRED');
 // No redirects to another host or a private address. A changed source is reviewed later.
 const response=await fetcher(u.href,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});
 if(!response.ok)throw Error('SOURCE_HTTP_'+response.status);
 if(!/text\/html/i.test(response.headers.get('content-type')||''))throw Error('HTML_SOURCE_REQUIRED');
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000)throw Error('SOURCE_TOO_LARGE');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function discoverExpleeResearch({env,fetcher=fetch,cursor=0,now=new Date()}){
 if(!env.EXPLEE_API_KEY)return {status:'EXPLEE_KEY_MISSING',candidates:[],nextCursor:cursor};
 const index=Math.max(0,Number(cursor)||0),state=states[index%states.length];
 const definition=segments[Math.floor(index/states.length)%segments.length];
 const payload={people_filters:{job_titles:['Owner','President','Operations Manager'],geo:['US'],people_per_company_limit:1},company_filters:{definition,geo_include:['US'],geo_subdivision:['US-'+state],size:{min:2,max:200}},page:1,page_size:10};
 // Official API: first result zone only. Never paginate into billed results,
 // use paid enrichments, criteria, or exclude_lists (which disables free results).
 const r=await fetcher('https://api.explee.com/public/api/v1/search/people',{method:'POST',signal:AbortSignal.timeout(25000),headers:{'X-API-Key':env.EXPLEE_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!r.ok)return {status:'EXPLEE_HTTP_'+r.status,candidates:[],nextCursor:cursor,retryAt:new Date(now.getTime()+(r.status===429?6*3600000:3600000)).toISOString()};
 const result=await r.json();
 if(!Array.isArray(result.people)||!result.meta||!Number.isFinite(result.meta.credits_charged))throw Error('EXPLEE_INVALID_SEARCH_RESPONSE');
 const candidates=result.people.map(p=>{
  const company=clean(p.company_name),contactName=clean([p.first_name,p.last_name].filter(Boolean).join(' '));
  const companyUrl=clean(p.company_url)||(p.company_domain?'https://'+p.company_domain:'');
  const key='explee:'+(clean(p.linkedin_url)||[p.company_domain,contactName,p.title].join('|')).toLowerCase();
  return {id:researchId(key),name:company,company_url:companyUrl,country:clean(p.company_geo)||clean(p.geo),industry:clean(p.company_industry),company_size:clean(p.company_size),buyer_role:clean(p.title),source:'EXPLEE_PUBLIC_API_FREE_RESEARCH',source_evidence_url:clean(p.linkedin_url)||companyUrl,status:'NEW',commercial_stage:'RESEARCH',data_quality:'CONTACT_RESEARCH_REQUIRED',problem_confirmed:false,next_action:'Verify named public business contact, need, Gmail history and suppressions before campaign release.',source_payload:{research:{key,contactName,contactRole:clean(p.title),discoveredAt:now.toISOString(),source:'Explee public API',companyContactEmails:p.company_emails||[],companyDescription:clean(p.company_description),query:{definition,state},buyerVerified:false,contactEligible:false},verification:{providerSearch:true,emailPublished:false,mxVerified:false,gmailHistory:'PENDING',crmHistory:'PENDING',humanVerified:false}}};
 }).filter(p=>p.name&&p.source_payload.research.contactName&&p.company_url&&p.country==='US');
 return {status:result.meta.credits_charged===0?'EXPLEE_FREE_SEARCH_COMPLETED':'EXPLEE_UNEXPECTED_CHARGE_HOLD',candidates,nextCursor:index+1,creditsCharged:result.meta.credits_charged,remainingBalance:result.meta.remaining_balance,query:{definition,state}};
}

export async function discoverPublicDemand({fetcher=fetch,cursor=0,now=new Date()}){
 const query=demandQueries[cursor%demandQueries.length],page=Math.floor(cursor/demandQueries.length)%10;
 const u=new URL('https://hn.algolia.com/api/v1/search_by_date');u.searchParams.set('query',query);u.searchParams.set('hitsPerPage','30');u.searchParams.set('page',String(page));u.searchParams.set('numericFilters','created_at_i>'+Math.floor(now.getTime()/1000-90*86400));
 const r=await fetcher(u,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('PUBLIC_DEMAND_HTTP_'+r.status);
 const data=await r.json();if(!Array.isArray(data.hits))throw Error('PUBLIC_DEMAND_INVALID_RESPONSE');
 const candidates=data.hits.filter(p=>/need|looking for|hiring|seeking|help|manual/i.test(plain(p.comment_text||p.story_text||p.title||''))).map(p=>({id:researchId('hn:'+p.objectID),name:clean(p.title||p.story_title||'Public workflow request'),source:'PUBLIC_DEMAND_HN',source_evidence_url:'https://news.ycombinator.com/item?id='+encodeURIComponent(p.objectID),status:'NEW',commercial_stage:'RESEARCH',data_quality:'UNVERIFIED_PUBLIC_DEMAND_SIGNAL',problem_confirmed:false,next_action:'Verify company, country, buyer identity and public contact; no outreach until qualified.',source_payload:{research:{key:'hn:'+p.objectID,publicText:plain(p.comment_text||p.story_text||'').slice(0,4000),discoveredAt:now.toISOString(),buyerVerified:false,contactEligible:false}}}));
 return {status:'PUBLIC_DEMAND_SEARCH_COMPLETED',candidates,nextCursor:cursor+1};
}

export function prepareCampaignDraft(lead,{workflow='QUOTE_REQUEST'}={}){
 const research=lead.source_payload?.research||{},name=clean(research.contactName).split(' ')[0];
 const process=workflow==='QUOTE_REQUEST'?'quote request process':'project inquiry form';
 return {subject:(workflow==='QUOTE_REQUEST'?'Quote request':'Project inquiry')+' handoffs at '+lead.name,body:`Hi ${name},\n\nI saw the ${process} on ${lead.name}'s website. When a request arrives, how do you keep its reference, owner, and next action together?\n\nBoltech Group offers a focused pilot to register, assign, and follow up on requests: one business, one web workflow, and one simple integration. If handoffs are a bottleneck for your team, which step would you want to improve first? We can discuss the scope by email.\n\nRicardo Bolaños\nBoltech Group\nhttps://boltech-group.vercel.app\n\nIf this is not relevant, reply "no thanks" and I will stop contacting you.`,preparedAt:new Date().toISOString(),sent:false};
}

export async function researchOfficialContact(lead,{fetcher=fetch,pageReader=readOfficialPage}={}){
 const name=clean(lead.source_payload?.research?.contactName),role=clean(lead.source_payload?.research?.contactRole);
 if(!name||!role||!lead.company_url)return lead;
 const root=new URL(lead.company_url),queue=[root.href],seen=new Set();
 while(queue.length&&seen.size<3){ // Per-site I/O bound, not a lead target.
  const url=queue.shift();if(seen.has(url))continue;seen.add(url);
  let html;try{html=await pageReader(url,{fetcher});}catch{continue;}
  const text=plain(html),lower=text.toLowerCase(),index=lower.indexOf(name.toLowerCase());
  if(index>=0){
   const block=text.slice(Math.max(0,index-300),index+700);
   const emails=[...new Set((block.match(/[a-z0-9.!#$%&'*+\/=\?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[]).map(x=>x.toLowerCase()))];
   const roleFound=block.toLowerCase().includes(role.toLowerCase());
   if(emails.length===1&&roleFound)return {...lead,contact_email:emails[0],source_evidence_url:url,source_payload:{...lead.source_payload,research:{...lead.source_payload.research,contactEvidenceExcerpt:block},verification:{...lead.source_payload.verification,officialNameRoleEmailLocated:true}}};
  }
  for(const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)){
   try{const link=new URL(match[1],root);if(link.protocol==='https:'&&link.hostname===root.hostname&&/contact|team|about/i.test(link.pathname)&&!seen.has(link.href)&&!queue.includes(link.href))queue.push(link.href);}catch{}
  }
 }
 return lead;
}

export async function verifyPublishedCandidate(lead,{fetcher=fetch,mxResolver=resolveMx,pageReader=readOfficialPage,now=new Date()}={}){
 const payload=lead.source_payload||{},research=payload.research||{},email=clean(lead.contact_email).toLowerCase();
 const verification={...payload.verification,checkedAt:now.toISOString(),emailSyntax:emailRe.test(email),mxVerified:false,emailPublished:false};
 if(!verification.emailSyntax||!research.contactName||!lead.source_evidence_url)return {verification,status:'CONTACT_RESEARCH_REQUIRED'};
 const source=new URL(lead.source_evidence_url),official=new URL(lead.company_url);
 if(source.hostname.replace(/^www\./,'')!==official.hostname.replace(/^www\./,''))return {verification,status:'OFFICIAL_CONTACT_SOURCE_REQUIRED'};
 try{
  const html=await pageReader(source.href,{fetcher}),text=plain(html).toLowerCase();
  verification.emailPublished=(text+' '+html.toLowerCase()).includes(email);
  verification.namedContactPublished=text.includes(clean(research.contactName).toLowerCase());
  verification.rolePublished=Boolean(research.contactRole)&&text.includes(clean(research.contactRole).toLowerCase());
  verification.quoteWorkflowPublished=/\b(?:quotes?|quoting|quotations?|rfq)\b/i.test(text);
  verification.contactFormPublished=/\bcontact\b|get in touch/i.test(text)&&/<form\b|<input\b|<textarea\b/i.test(html);
  verification.publishedWorkflow=verification.quoteWorkflowPublished?'QUOTE_REQUEST':verification.contactFormPublished?'CONTACT_REQUEST':null;
  const mx=await mxResolver(email.split('@')[1]);verification.mxVerified=mx.some(x=>x.exchange&&x.exchange!=='.');
  verification.mxCheckedAt=now.toISOString();verification.mxRecords=mx.filter(x=>x.exchange&&x.exchange!=='.').map(x=>({exchange:x.exchange,priority:x.priority}));
  const complete=verification.emailPublished&&verification.namedContactPublished&&verification.rolePublished&&Boolean(verification.publishedWorkflow)&&verification.mxVerified;
  const reviewed=verification.humanVerified===true||verification.officialSourceReviewed===true;
  return {verification,status:complete?(reviewed?'PREPARED_PENDING_HISTORY_CHECK':'PREPARED_PENDING_EVIDENCE_REVIEW'):'CONTACT_RESEARCH_REQUIRED',draft:complete?prepareCampaignDraft(lead,{workflow:verification.publishedWorkflow}):null};
 }catch(e){return {verification,status:'CONTACT_VERIFICATION_RETRY',error:safeError(e)};}
}

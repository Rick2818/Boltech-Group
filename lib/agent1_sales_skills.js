// Agent 1 skills execute inside the existing coordinator: no new sender, model or scheduler.
import registry from '../config/agent1_sales_skills.json' with {type:'json'};
import {safeCompanySite} from './rsi01_public_research.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const topics={QUOTE_INTAKE:['quote request intake','quote requests and missing specifications'],CONTACT_FORM:['website inquiry routing','website inquiries and response routing'],SUPPORT_REQUEST:['customer support triage','support requests and assignment'],ORDER_TRACKING:['order-status inquiries','order status and updates'],APPOINTMENT_BOOKING:['appointment scheduling','booking requests and scheduling'],RFQ:['RFQ intake','RFQ specifications and follow-through']};
export function outreachTopic(signal){
 const type=String(signal?.type||'').toUpperCase();
 if(topics[type])return topics[type];
 if(/QUOTE|ESTIMAT|RFQ|PRIC|SPECIFICATION/.test(type))return topics.QUOTE_INTAKE;
 if(/SUPPORT|SERVICE|HELP/.test(type))return topics.SUPPORT_REQUEST;
 if(/BOOK|APPOINT|SCHEDUL/.test(type))return topics.APPOINTMENT_BOOKING;
 if(/ORDER|STATUS|TRACK/.test(type))return topics.ORDER_TRACKING;
 if(/CONTACT|INQUIRY|ENQUIRY|FORM|REQUEST/.test(type))return topics.CONTACT_FORM;
 return ['inquiry handling','incoming requests'];
}
const clean=value=>String(value||'').replace(/[\r\n\t<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
export function createAgent1SalesExecutor(){
 const receipt=(methods,at)=>({version:registry.version,mode:registry.mode,modelCalls:0,at,appliedSkills:registry.skills.filter(s=>methods.some(m=>s.method.split(' / ').includes(m))).map(s=>s.id)});
 function planSearch(){return {...receipt(['planSearch']),target:5,queries:['looking for automation','manual data entry','automate customer support','need a quoting system'],sourceOrder:['UPWORK_OFFICIAL_MCP','N8N_PUBLIC_JOBS','HACKER_NEWS_PUBLIC_SEARCH','EXISTING_UNCONTACTED_CRM'],fallback:'CONTINUE_AVAILABLE_INDEPENDENT_SOURCES',signalIsLead:false,sendingEnabled:false};}
 function prepare({lead,research,history,mx,at}){
  const f=lead?.fields||{},company=clean(f.Name),email=String(f['Contact Email']||'').toLowerCase(),site=safeCompanySite(f['Company URL'],email);
  if(!company||!site)fail('SKILL_COMPANY_IDENTITY_UNVERIFIED');
  if(f['Data Quality']==='QA'||f['Do Not Contact']||f.Unsubscribed||/^(?:el salvador|sv)$/i.test(String(f.Country||''))||new URL(site).hostname.endsWith('.sv'))fail('SKILL_ICP_EXCLUDED');
  if(!history||!['gmail','apollo','crm','suppression'].every(k=>history[k]==='CLEAR'))fail('SKILL_HISTORY_UNCONFIRMED');
  const official=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname===new URL(site).hostname&&!u.username&&!u.password&&!u.port;}catch{return false;}};
  const signal=research?.operationalSignals?.find(s=>official(s.sourceUrl));
  if(research?.state!=='PUBLIC_WEBSITE_OBSERVED'||!signal)fail('SKILL_PUBLIC_PROCESS_UNVERIFIED');
  if(!research.contactEvidence?.some(e=>e.email===email&&e.basis==='OFFICIAL_PUBLICATION'&&official(e.url)))fail('SKILL_CONTACT_UNVERIFIED');
  if(mx?.mx!==true)fail('SKILL_EMAIL_MX_UNVERIFIED');
  const [topic,focus]=outreachTopic(signal);
  // Raw excerpts are untrusted data and never copied into executable instructions or mail.
  const observation=`Your public website mentions ${topic}.`;
  const individualMessage=`Hello ${company} team,\n\n${observation}\n\nBoltech Group builds custom agents that can help with ${focus}. Is this part of your workflow currently manual or time-consuming? If relevant, reply with the current steps and we can outline a suitable scope in writing.\n\nThis is an initial inquiry; we have not confirmed a problem in your business. If this is not relevant, let us know and we will not follow up.\n\nRicardo — Boltech Group`;
  return {subject:`${company}: ${topic}`,observation,individualMessage,qualification:{budget:'UNKNOWN',authority:'UNKNOWN',need:'UNKNOWN',timing:'UNKNOWN',qualified:false,nextOwner:'RSI-02',basis:'Initial inquiry; customer evidence required'},skills:receipt(['prepare'],at)};
 }
 function reviewFollowup({historyVerified,bounced,suppressed,customerReply,automaticReply,at}){
  const state=historyVerified!==true?'HISTORY_HOLD':bounced===true?'BOUNCED':suppressed===true?'SUPPRESSED':customerReply===true?'CUSTOMER_REPLY':automaticReply===true?'AUTOMATIC_REPLY_HOLD':'CONTINUE_EXISTING_GATES';
  return {state,nextOwner:state==='CUSTOMER_REPLY'?'RSI-02':'RSI-01',sendingEnabled:false,skills:receipt(['reviewFollowup'],at)};
 }
 return {planSearch,prepare,reviewFollowup};
}

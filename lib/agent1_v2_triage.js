// Conservative, source-aware lead triage for Agent 1 V2.
// A marketplace project is never an email lead. All candidates require review.
const needs=/\b(automation|workflow|ai agents?|customer support|crm integration|make\.com|n8n|automatizaci[oó]n)\b/i;
const unsafe=/\b(bypass|captcha evasion|credential harvesting|spam|scraping protections)\b/i;
const us=x=>/^(US|USA|United States)$/i.test(String(x||'').trim());
export function triageAgent1Candidates(sources,{max=5}={}){
 if(!Number.isInteger(max)||max<1||max>5)throw Error('INVALID_LIMIT');
 const checked=[],selected=[];const diagnostics={};
 for(const source of sources||[]){
  diagnostics[source.source]={observed:(source.candidates||[]).length,countryMissing:0,needsVerification:0};
  for(const p of source.candidates||[]){
   const combined=[p.title,p.businessNeed,p.description].filter(Boolean).join(' ');
   const country=p.country||p.clientCountry||'';
   const acceptable=us(country)&&needs.test(combined)&&!unsafe.test(combined);
   const reason=!us(country)?'COUNTRY_UNCONFIRMED_OR_OUTSIDE_US':unsafe.test(combined)?'UNSUITABLE_REQUEST':!needs.test(combined)?'NO_AUTOMATION_NEED_SIGNAL':'RESEARCH_REQUIRED';
   const record={source:source.source,sourceId:p.sourceId,title:p.title,company:p.company,country,reason,contactEligible:false,sendAllowed:false,channel:source.source==='UPWORK'?'UPWORK_PROPOSAL':'VERIFIED_BUSINESS_EMAIL_AFTER_REVIEW'};
   checked.push(record);
   if(!country)diagnostics[source.source].countryMissing++;
   diagnostics[source.source].needsVerification++;
   // A promising listing is NOT a verified lead. Never include it in a deliverable batch.
   if(acceptable)record.reason='AWAITING_FULL_VERIFICATION';
  }
 }
 return {checked:checked.length,selected:[],status:'INCOMPLETE',ready:false,qualifiedForOutbound:0,sent:0,remaining:max,diagnostics};
}

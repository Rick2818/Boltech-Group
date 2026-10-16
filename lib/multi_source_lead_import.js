// Authorized multi-source intake bridge. No scraping, messaging, paid API calls or claim of autonomous access.
// Receives records supplied by a permitted export, webhook relay, or operator.
// Operational auth is enforced by the API router before this module is called.
import {createMarketingCrmExecutor} from './marketing_crm_executor.js';

const sources = new Set(['Lusha', 'Explee', 'Upwork']);
const err = code => Object.assign(new Error(code), {code});
function normalize(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item) || !sources.has(item.source))
    throw err('MARKETING_IMPORT_INVALID_SOURCE');
  if (item.synthetic === true || item.test === true) throw err('MARKETING_IMPORT_SYNTHETIC_REJECTED');
  let url;
  try { url = new URL(item.sourceUrl); } catch { throw err('MARKETING_IMPORT_INVALID_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw err('MARKETING_IMPORT_INVALID_URL');
  if (item.source === 'Upwork' && !(url.hostname === 'upwork.com' || url.hostname.endsWith('.upwork.com')))
    throw err('MARKETING_IMPORT_INVALID_URL');
  if (item.source === 'Lusha' && !(url.hostname === 'lusha.com' || url.hostname.endsWith('.lusha.com')))
    throw err('MARKETING_IMPORT_INVALID_URL');
  if (item.source === 'Explee' && !(url.hostname === 'explee.com' || url.hostname.endsWith('.explee.com')))
    throw err('MARKETING_IMPORT_INVALID_URL');
  if (!String(item.company || '').trim()) throw err('MARKETING_IMPORT_COMPANY_REQUIRED');
  if (item.source === 'Upwork' && item.email) throw err('MARKETING_IMPORT_UPWORK_OFF_PLATFORM_BLOCKED');
  if (item.source !== 'Upwork' && !String(item.email || '').trim()) throw err('MARKETING_IMPORT_EMAIL_REQUIRED');
  return {company:item.company,email:item.email || '',source:item.source,
    sourceUrl:url.href,contact:item.contact || '',country:item.country || ''};
}
export function createMultiSourceLeadImport({crm=createMarketingCrmExecutor()}={}) {
  return {async run(body) {
    if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 5)
      throw err('MARKETING_IMPORT_INVALID_BATCH');
    // Validate entire batch first; do not partly write malformed batches.
    const normalized=body.items.map(normalize);
    const seen=new Set(),receipts=[];
    for(const p of normalized) {
      const key=p.source==='Upwork' ? p.sourceUrl.toLowerCase() : p.email.trim().toLowerCase();
      if(seen.has(key)) {receipts.push({source:p.source,state:'DUPLICATE_BATCH'});continue;}
      seen.add(key);
      try {
        const r=await crm.intake(p);
        if(r.success!==true || !r.recordId) throw err('MARKETING_IMPORT_UNCONFIRMED');
        receipts.push({source:p.source,recordId:r.recordId,state:r.created?'RESEARCH_ONLY_CREATED':'DUPLICATE_EXISTING'});
      } catch {
        // Uncertain writes must be reconciled, never automatically re-sent.
        receipts.push({source:p.source,state:'WRITE_UNCONFIRMED'});
        break;
      }
    }
    return {success:true,mode:'AUTHORIZED_IMPORT_ONLY',autonomousProviderAccess:false,
      received:normalized.length,receipts,qualifiedLeadsCertified:0,sendingPerformed:false};
  }};
}

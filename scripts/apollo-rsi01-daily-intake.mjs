#!/usr/bin/env node
// Read-only Apollo -> RSI-01 research handoff, no Gmail sends, no enrichment charges.
// Handles absent secrets and API plan restrictions without fabricating leads.
import crypto from 'node:crypto';
const token = process.env.PARTNER_API_TOKEN || '';
const url = 'https://boltech-group.vercel.app/api/partners?action=apollo-leads-saved';
const airtableToken = process.env.AIRTABLE_TOKEN || '';
const base = process.env.AIRTABLE_BASE_ID || '';
const output = { source: 'APOLLO_SAVED_CONTACT', reviewed: 0, created: 0, existing: 0, blocked: null, sent: 0 };
const fail = code => { output.blocked = code; throw Error(code); };
try {
  if (!token || !airtableToken || !base) fail('MISSING_OPERATIONAL_OR_AIRTABLE_SECRET');
  const response = await fetch(url, {headers: {Authorization: 'Bearer '+token},signal:AbortSignal.timeout(26000)});
  const result = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
  if (!response.ok || result.success !== true) fail(typeof result.code === 'string' && /^APOLLO_[A-Z_]+$/.test(result.code) ? result.code : 'APOLLO_ROUTE_UNAVAILABLE');
  if (result.complete !== true || !Array.isArray(result.leads)) fail('APOLLO_INCOMPLETE_LEADS');
  const candidates = result.leads.filter(c => c.source === 'APOLLO_SAVED_CONTACT' && c.emailValidation?.syntax === true && c.contactEligible === false && /^[a-f0-9]{24}$/.test(c.apolloContactId||''));
  const endpoint='https://api.airtable.com/v0/'+encodeURIComponent(base)+'/RSI%20Agent%20Work';
  const headers = {Authorization:'Bearer '+airtableToken,'Content-Type':'application/json'};
  for (const c of candidates) {
    if (output.created >= 5) break;
    const id='APOLLO:RSI01:'+crypto.createHash('sha256').update(c.apolloContactId).digest('hex').slice(0,32);
    const search=await fetch(endpoint+'?'+new URLSearchParams({filterByFormula:'{Work ID}="'+id+'"',maxRecords:'2'}),{headers,signal:AbortSignal.timeout(10000)});
    if(!search.ok)fail('AIRTABLE_LOOKUP_FAILED');
    const existing=await search.json();if(!Array.isArray(existing.records))fail('AIRTABLE_INVALID_LOOKUP');
    if(existing.records.length){output.existing++;continue;}
    const evidence={source:'APOLLO_SAVED_CONTACT',apolloContactId:c.apolloContactId,company:c.company,contactEmail:c.contactEmail,contactName:c.name,title:c.title,domain:c.domain,providerStatus:c.providerEmailStatus,synthetic:false,contactEligible:false,notVerifiedBuyer:true};
    const post=await fetch(endpoint,{method:'POST',headers,signal:AbortSignal.timeout(10000),body:JSON.stringify({records:[{fields:{'Work ID':id,RSI:'RSI-01',Owner:'RSI-01',Status:'RESEARCH_REQUIRED','Account Domain':c.domain,'Source Record ID':c.apolloContactId,Evidence:JSON.stringify(evidence),'Next Action':'Independently qualify buyer, pain, relevance, existing Gmail history, suppression and lawful outreach before approval.','Handoff To':'RSI-01',Authorization:'APOLLO_READ_ONLY; NO SEND','Execution State':'BLOCKED'}}]})});
    if(!post.ok)fail('AIRTABLE_WRITE_UNCERTAIN');
    const receipt=await post.json();if(!receipt.records?.[0]?.id)fail('AIRTABLE_WRITE_UNCERTAIN');
    output.created++;
  }
  output.reviewed=output.created + output.existing;
  if(output.created<5)output.blocked='FEWER_THAN_FIVE_NEW_SAVED_CONTACTS_FOR_RESEARCH';
}catch(e){output.blocked ||= 'INTEGRATION_UNCONFIRMED';process.exitCode=1;}
console.log(JSON.stringify(output));
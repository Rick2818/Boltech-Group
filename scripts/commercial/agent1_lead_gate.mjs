// The gate never converts an Apollo contact into a verified buyer by inference.
export function assessLead(lead) {
  const problems = [];
  if (!lead || typeof lead !== 'object') return {eligible:false,problems:['MISSING_LEAD']};
  const present = x => typeof x === 'string' && x.trim().length > 1;
  for (const [key,reason] of [['company','COMPANY_MISSING'],['name','CONTACT_MISSING'],['title','ROLE_MISSING'],['domain','DOMAIN_MISSING'],['businessNeed','NEED_MISSING']]) {
    if (!present(lead[key])) problems.push(reason);
  }
  if (!present(lead.contactEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.contactEmail)) problems.push('EMAIL_INVALID');
  if (lead.emailValidation?.mailboxConfirmed !== true) problems.push('MAILBOX_UNCONFIRMED');
  if (lead.buyerVerified !== true) problems.push('BUYER_UNVERIFIED');
  if (lead.needVerified !== true) problems.push('NEED_UNVERIFIED');
  if (lead.sourceVerified !== true) problems.push('SOURCE_UNVERIFIED');
  return {eligible:problems.length===0,problems};
}
export function selectFiveLeads(candidates,previouslyContacted=[]) {
  const accepted=[],rejected=[],seen=new Set(previouslyContacted.map(x=>String(x).trim().toLowerCase()));
  for (const lead of candidates || []) {
    const evaluation=assessLead(lead);
    const key=String(lead?.contactEmail||'').trim().toLowerCase();
    if (seen.has(key)) evaluation.problems.push('DUPLICATE');
    if (evaluation.problems.length) rejected.push({leadId:lead?.leadId||null,problems:evaluation.problems});
    else if (accepted.length<5) accepted.push(lead);
    if (key) seen.add(key);
  }
  return {accepted,rejected,complete:accepted.length===5,missing:5-accepted.length,nextAction:accepted.length===5?'HANDOFF_AGENT_2':'RESEARCH_REPLACEMENTS'};
}

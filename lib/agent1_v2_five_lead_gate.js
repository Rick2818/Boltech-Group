// Compatibility name retained for existing imports; there is no fixed batch size.
export const releaseFiveVerifiedLeads=(candidates)=>releaseVerifiedProspects(candidates);
// Unlimited research/qualification release: never requires a batch of five.
// Outreach remains independently gated by provider policy and durable suppression checks.
export function releaseVerifiedProspects(candidates){
 const emailRe=/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
 const unique=new Map();
 for(const p of candidates||[]){
  const email=String(p?.email||'').trim().toLowerCase();
  if(!emailRe.test(email)||!/^(US|USA|United States)$/i.test(String(p?.country||''))||
     !p.company||!p.contactName||!p.contactRole||!p.officialWebsite?.startsWith('https://')||
     !p.sourceUrl?.startsWith('https://')||!p.publishedBusinessContact||!p.mxVerified||
     !p.humanVerified||!p.buyerVerified||p.synthetic||p.suppressed||p.bounced||p.unsubscribed||
     p.suppressionStatus!=='CLEAR'||p.crmHistory!=='CLEAR'||p.gmailHistory!=='CLEAR'||
     p.consentOrOutreachCompliance!=='CLEAR')continue;
  unique.set(email,{...p,email});
 }
 return {ready:unique.size>0,status:'RESEARCH_QUALIFIED',verifiedCount:unique.size,leads:[...unique.values()],send:false};
}

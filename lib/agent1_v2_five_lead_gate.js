// Release policy: EXACTLY five independent, fully verified US B2B leads.
// Incomplete batches are withheld, not padded with unverified candidates.
const emailRe=/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export function releaseFiveVerifiedLeads(candidates,{target=5}={}){
 if(target!==5)throw Error('FIVE_VERIFIED_LEADS_REQUIRED');
 const unique=new Map();
 for(const p of candidates||[]){
  const email=String(p?.email||'').trim().toLowerCase();
  const complete=Boolean(p?.company&&p?.country&&/^(US|USA|United States)$/i.test(p.country)&&
   emailRe.test(email)&&p?.contactName&&p?.contactRole&&
   /^https:\/\//.test(String(p?.officialWebsite||''))&&
   /^https:\/\//.test(String(p?.sourceUrl||''))&&
   p?.verifiedBusinessNeed===true&&p?.needEvidenceUrl&&
   p?.publishedBusinessContact===true&&p?.mxVerified===true&&
   p?.humanVerified===true&&p?.gmailHistory==='CLEAR'&&
   p?.crmHistory==='CLEAR'&&p?.suppressionStatus==='CLEAR'&&
   p?.consentOrOutreachCompliance==='CLEAR'&&
   p?.buyerVerified===true&&!p?.synthetic&&!p?.bounced&&!p?.unsubscribed);
  if(complete&&!unique.has(email))unique.set(email,{...p,email});
 }
 const verified=[...unique.values()];
 // Avoid exposing partial lists through this release API.
 if(verified.length<5)return {ready:false,status:'WITHHELD_INCOMPLETE',verifiedCount:verified.length,remaining:5-verified.length,leads:[]};
 return {ready:true,status:'READY_FOR_REVIEW',verifiedCount:5,remaining:0,leads:verified.slice(0,5)};
}

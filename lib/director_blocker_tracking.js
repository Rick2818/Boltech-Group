export function reviewBlockers(previous=[],current=[],checkedAt=new Date().toISOString(),resolutions=[]){
 const old=new Map(previous.map(x=>[x.role+':'+x.code,x]));
 const active=current.map(x=>{const prior=old.get(x.role+':'+x.code);const checks=(prior?.checks||0)+1;return {...x,checks,firstSeen:prior?.firstSeen||checkedAt,lastSeen:checkedAt,escalated:checks>=3};});
 const missing=previous.filter(x=>!active.some(y=>x.role===y.role&&x.code===y.code));
 const valid=b=>resolutions.find(r=>r.role===b.role&&r.code===b.code&&r.verified===true&&typeof r.evidenceRef==='string'&&r.evidenceRef.trim()&&Number.isFinite(Date.parse(r.resolvedAt))&&Date.parse(r.resolvedAt)<=Date.parse(checkedAt)&&(!b.firstSeen||Date.parse(r.resolvedAt)>=Date.parse(b.firstSeen)));
 const resolved=missing.filter(valid).map(b=>({...b,status:'RESOLVED_WITH_EVIDENCE',resolution:valid(b)}));
 const absent=missing.filter(b=>!valid(b)).map(x=>({...x,status:'AWAITING_RESOLUTION_EVIDENCE'}));
 return {active,absent,resolved,checkedAt,escalations:active.filter(x=>x.escalated),proof:'No missing blocker is assumed fixed; explicit verified resolution receipts retire absent entries.'};
}

export function reviewBlockers(previous=[],current=[],checkedAt=new Date().toISOString()){
 const old=new Map(previous.map(x=>[x.role+':'+x.code,x]));
 const active=current.map(x=>{const prior=old.get(x.role+':'+x.code);const checks=(prior?.checks||0)+1;return {...x,checks,firstSeen:prior?.firstSeen||checkedAt,lastSeen:checkedAt,escalated:checks>=3};});
 const absent=previous.filter(x=>!active.some(y=>x.role===y.role&&x.code===y.code)).map(x=>({...x,status:'AWAITING_RESOLUTION_EVIDENCE'}));
 return {active,absent,checkedAt,escalations:active.filter(x=>x.escalated),proof:'No missing blocker is assumed fixed.'};
}

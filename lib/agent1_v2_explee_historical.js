// Historical Explee prospect import, isolated from the retired security-scanner product.
// This is a read-only candidate source; no Explee API or sending authorization is implied.
import legacyRows from '../pipeline/leads_explee_ai_verificados.json' with {type:'json'};
import candidateRows from '../pipeline/leads_verificados_explee_candidatos.json' with {type:'json'};
const safe=x=>String(x||'').trim();
export function readExpleeHistorical({limit=50}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('EXPLEE_INVALID_LIMIT');
 const rows=[...legacyRows,...candidateRows],seen=new Set(),items=[];
 for(const row of rows){
  const company=safe(row.company),domain=safe(row.domain).toLowerCase(),email=safe(row.contactEmail).toLowerCase();
  if(!company||!domain||!email||!/^\S+@\S+\.\S+$/.test(email))continue;
  const key=domain+'|'+email;
  if(seen.has(key))continue;
  seen.add(key);
  items.push({id:key,company,title:'',email,sourceUrl:'https://'+domain,
   country:safe(row.country),source:'EXPLEE_HISTORICAL_EXPORT',
   contactVerified:false,buyerVerified:false,
   legacySecurityScanOnly:true,sendAllowed:false});
  if(items.length>=limit)break;
 }
 return items;
}

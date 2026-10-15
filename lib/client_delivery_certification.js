const orderPattern=/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,79}$/;
export async function checkDelivery({orderId,mode,url,fetcher=fetch}={}){
 const result={schemaVersion:1,orderId:orderId||null,mode:mode||null,timestamp:new Date().toISOString(),status:'FAIL',checks:{validOrder:false,productionReachable:false,customerEvidence:false},blockers:[],certificationScope:'NO_CUSTOMER_DELIVERY_CERTIFIED'};
 if(!orderPattern.test(orderId||''))result.blockers.push('INVALID_ORDER_ID');
 else result.checks.validOrder=true;
 if(!['synthetic','customer'].includes(mode))result.blockers.push('INVALID_MODE');
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='boltech-group.vercel.app')throw Error('INVALID_DEPLOYMENT');
  const r=await fetcher(u.toString(),{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});
  result.checks.productionReachable=r.ok;
  if(!r.ok)result.blockers.push('VERCEL_HTTP_'+r.status);
 }catch{result.blockers.push('VERCEL_REACHABILITY_UNCONFIRMED');}
 if(mode==='customer')result.blockers.push('CUSTOMER_ACCEPTANCE_AND_DELIVERY_RECEIPTS_REQUIRED');
 else if(mode==='synthetic'&&result.checks.validOrder&&result.checks.productionReachable){result.status='INFRA_PASS';result.certificationScope='INFRASTRUCTURE_ONLY';}
 if(result.status==='FAIL'&&result.blockers.length===0)result.blockers.push('REQUIREMENTS_NOT_SATISFIED');
 return result;
}

const origin='https://boltech-group.vercel.app';
export async function verifyDeployedRevision({expectedCommit,token,fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),attempts=36,now=()=>new Date().toISOString()}){
  const report={scope:'VERCEL_READ_ONLY_PRODUCTION_PROBE',at:now(),expectedCommit,status:'FAILED',gmailVerified:false,readOnly:true};
  if(!/^[a-f0-9]{40}$/i.test(expectedCommit||''))return {...report,code:'VERCEL_INVALID_EXPECTED_COMMIT'};
  if(!token)return {...report,code:'SDR_ADMIN_AUTH_MISSING'};
  try{
    let matched=false;
    for(let i=0;i<attempts;i++){
      try{
        const res=await fetcher(origin+'/api/partners?action=rsi-agents',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
        const p=await res.json();
        if(res.status===401||res.status===403)return {...report,code:'VERCEL_PROBE_AUTH_REJECTED'};
        if(res.ok&&p.success===true&&p.deploymentCommit===expectedCommit){report.deploymentCommit=p.deploymentCommit;matched=true;break;}
      }catch{}
      if(i+1<attempts)await wait(5000);
    }
    if(!matched)return {...report,code:'VERCEL_EXPECTED_REVISION_NOT_OBSERVED'};
    const res=await fetcher(origin+'/api/partners?action=sdr-verify',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
    const p=await res.json();
    if(!res.ok||p.success!==true||p.verified!==true||p.sender!=='ricardo.boltechgroup@gmail.com')return {...report,code:/^GMAIL_[A-Z_]+$/.test(p.code||'')?p.code:'VERCEL_GMAIL_PROBE_UNCONFIRMED'};
    return {...report,at:now(),status:'VERIFIED_EXACT_REVISION_AND_GMAIL',sameCommit:true,gmailVerified:true,sender:p.sender};
  }catch{return {...report,code:'VERCEL_PROBE_UNCONFIRMED'};}
}

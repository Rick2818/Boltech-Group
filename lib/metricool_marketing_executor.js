import { campaignLandingUrl, INSTITUTIONAL_LINKEDIN_ORG, MARKETING_CAMPAIGNS } from './marketing_distribution.js';
// Uses Metricool official API only with an explicitly provisioned paid-plan token.
// A stable distributed lock prevents duplicated external posts after uncertain failures.
export async function scheduleInstitutionalCampaign({campaignId,dateTime,text,organization=INSTITUTIONAL_LINKEDIN_ORG,command,fetcher=fetch,token=process.env.METRICOOL_API_TOKEN}={}){
 if(!MARKETING_CAMPAIGNS.includes(campaignId)||organization!==INSTITUTIONAL_LINKEDIN_ORG)throw Error('MARKETING_INSTITUTIONAL_IDENTITY_REQUIRED');
 if(typeof dateTime!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(dateTime)||Number.isNaN(Date.parse(dateTime+'-06:00'))||Date.parse(dateTime+'-06:00')<=Date.now()+120000)throw Error('MARKETING_FUTURE_DATE_REQUIRED');
 if(typeof text!=='string'||text.length<50||text.length>2500)throw Error('MARKETING_CONTENT_INVALID');
 if(!token) return {status:'BLOCKED',code:'METRICOOL_API_TOKEN_REQUIRED',scheduled:false};
 if(typeof command!=='function')return {status:'BLOCKED',code:'MARKETING_DEDUP_STORE_REQUIRED',scheduled:false};
 const key='boltech:marketing:metricool:'+campaignId+':'+dateTime.slice(0,10);
 const prior=await command(['GET',key]);if(prior)return {status:'RECONCILE_REQUIRED',code:'MARKETING_POST_ALREADY_RESERVED',scheduled:false};
 const marker=await command(['SET',key,JSON.stringify({state:'RESERVED',campaignId,dateTime}),'NX']);
 if(marker!=='OK')return {status:'RECONCILE_REQUIRED',code:'MARKETING_POST_ALREADY_RESERVED',scheduled:false};
 const body={publicationDate:{dateTime,timezone:'America/El_Salvador'},providers:[{network:'linkedin'}],
  linkedinData:{type:'POST',previewIncluded:true},text:text+'\n\n'+campaignLandingUrl(campaignId),autoPublish:true,draft:false};
 const url=new URL('https://app.metricool.com/api/v2/scheduler/posts');
 url.searchParams.set('blogId','7529004');url.searchParams.set('userId','5863061');
 try{
  const response=await fetcher(url,{method:'POST',headers:{'X-Mc-Auth':token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {status:'BLOCKED',code:'METRICOOL_API_REJECTED_RECONCILE',scheduled:false};
  const parsed=await response.json();const id=parsed?.data?.id??parsed?.id;
  if(!id)return {status:'RECONCILE_REQUIRED',code:'METRICOOL_RECEIPT_MISSING',scheduled:false};
  await command(['SET',key,JSON.stringify({state:'SCHEDULED',providerId:String(id),campaignId,dateTime})]);
  return {status:'SCHEDULED',providerId:String(id),scheduled:true,published:false,network:'linkedin',organization};
 }catch{return {status:'RECONCILE_REQUIRED',code:'METRICOOL_PROVIDER_RESULT_UNKNOWN',scheduled:false};}
}

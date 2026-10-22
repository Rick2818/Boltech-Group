// Supabase-backed outbound gate. Never sends mail itself; caller must reconcile Gmail before retries.
const EMAIL=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const APPROVED=['AUTHORIZED','RESERVED','SENDING','SENT'];
export function createCommercialDispatchGate({fetcher=fetch,env=process.env}={}){
 const url=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 async function request(path,options={}){
  if(!url||!key)throw Error('SUPABASE_DISPATCH_NOT_CONFIGURED');
  const response=await fetcher(url+'/rest/v1/commercial_outbound_dispatch'+path,{
   ...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers}
  });
  if(!response.ok)throw Error('SUPABASE_DISPATCH_HTTP_'+response.status);
  const body=await response.text();return body?JSON.parse(body):null;
 }
 async function get(idempotencyKey){
  const rows=await request('?idempotency_key=eq.'+encodeURIComponent(idempotencyKey)+'&select=*');
  return rows?.[0]||null;
 }
 async function hold({leadId,campaignKey,idempotencyKey,email,subject,body}){
  if(!leadId||!campaignKey||!idempotencyKey||!EMAIL.test(email||'')||!subject||!body)throw Error('DISPATCH_INVALID_DRAFT');
  await request('?on_conflict=idempotency_key',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([{
   lead_id:leadId,campaign_key:campaignKey,idempotency_key:idempotencyKey,
   recipient_email:email.toLowerCase(),subject,body_text:body,state:'HELD'
  }])});
  const row=await get(idempotencyKey);
  if(!row||row.lead_id!==leadId||row.campaign_key!==campaignKey||row.recipient_email!==email.toLowerCase())throw Error('DISPATCH_IDEMPOTENCY_COLLISION');
  return row;
 }
 async function authorize(idempotencyKey,{authorization,eligibility,suppression}={}){
  if(authorization?.approved!==true||eligibility?.approved!==true||suppression?.clear!==true)throw Error('DISPATCH_REVIEW_REQUIRED');
  const rows=await request('?idempotency_key=eq.'+encodeURIComponent(idempotencyKey)+'&state=eq.HELD',{
   method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({
    state:'AUTHORIZED',authorization_evidence:authorization,eligibility_evidence:eligibility,suppression_evidence:suppression,updated_at:new Date().toISOString()
   })
  });
  if(rows?.length!==1)throw Error('DISPATCH_AUTHORIZATION_CONFLICT');
  return rows[0];
 }
 async function reserve(idempotencyKey){
  const rows=await request('?idempotency_key=eq.'+encodeURIComponent(idempotencyKey)+'&state=eq.AUTHORIZED',{
   method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({state:'RESERVED',reserved_at:new Date().toISOString(),updated_at:new Date().toISOString()})
  });
  if(rows?.length!==1)throw Error('DISPATCH_ALREADY_RESERVED_OR_BLOCKED');
  return rows[0];
 }
 // Provider call must only occur after the caller durably marks SENDING.
 // Unknown outcomes remain UNCERTAIN and must be reconciled, never resent blindly.
 async function markSending(idempotencyKey){
  const rows=await request('?idempotency_key=eq.'+encodeURIComponent(idempotencyKey)+'&state=eq.RESERVED',{
   method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({state:'SENDING',updated_at:new Date().toISOString()})
  });
  if(rows?.length!==1)throw Error('DISPATCH_SEND_NOT_RESERVED');
  return rows[0];
 }
 async function receipt(idempotencyKey,{messageId,sentAt}){
  if(!messageId||!sentAt||!Number.isFinite(Date.parse(sentAt)))throw Error('DISPATCH_PROVIDER_RECEIPT_REQUIRED');
  const rows=await request('?idempotency_key=eq.'+encodeURIComponent(idempotencyKey)+'&state=eq.SENDING',{
   method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({state:'SENT',provider_message_id:messageId,sent_at:sentAt,updated_at:new Date().toISOString()})
  });
  if(rows?.length!==1)throw Error('DISPATCH_RECEIPT_CONFLICT');
  return rows[0];
 }
 return {get,hold,authorize,reserve,markSending,receipt};
}

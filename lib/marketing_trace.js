const fail=code=>{throw Object.assign(new Error(code),{code,statusCode:409});};
const strings=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
const addresses=value=>String(value||'').toLowerCase().match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[];
export function createMarketingTrace({readEvent,updateEvent,listEvents,message,lead,sender,search,thread,now=()=>new Date().toISOString()}){
 async function owned(input){const row=await readEvent(input.eventId);if(!row?.material)fail('MARKETING_REQUEST_NOT_FOUND');if(row.from!==input.from)fail('MARKETING_REVIEW_OWNER_MISMATCH');return row;}
 async function review(input){
  const row=await owned(input);if(input.materialFingerprint!==row.material.fingerprint)fail('MARKETING_MATERIAL_VERSION_MISMATCH');
  if(row.marketingReview)return {success:true,eventId:row.eventId,reused:true,review:row.marketingReview};
  const valid=row.material.requestedBy===input.from&&['es','en'].every(lang=>row.material.materials?.[lang]?.cta&&strings(row.material.materials[lang]).every(v=>v.trim().length>0&&!/[\x00-\x08]/.test(v)));
  if(!valid)fail('MARKETING_MATERIAL_REVIEW_FAILED');
  const next={...row,marketingReview:{status:'ACCEPTED',reviewedBy:input.from,reviewedAt:now(),materialFingerprint:row.material.fingerprint,basis:'Existing sales agent accepted structurally verified private material; customer need and delivery permissions still required'},materialAcceptance:'ACCEPTED',salesAcceptance:row.salesAcceptance==='FAILED'?'FAILED':'ACCEPTED'};
  await updateEvent(row,next);return {success:true,eventId:row.eventId,review:next.marketingReview};
 }
 async function use(input){
  const row=await owned(input);if(!row.marketingReview||row.marketingReview.materialFingerprint!==row.material.fingerprint)fail('MARKETING_ACCEPTANCE_REQUIRED');
  if(row.marketingUse){if(row.marketingUse.messageId!==input.messageId)fail('MARKETING_USAGE_CONFLICT');return {success:true,eventId:row.eventId,reused:true,use:row.marketingUse};}
  if(!['es','en'].includes(input.language))fail('MARKETING_LANGUAGE_REQUIRED');
  const [account,sent]=await Promise.all([lead(row.opportunityId),message(input.messageId)]);
  const email=String(account?.fields?.['Contact Email']||'').toLowerCase();
  const fragment=strings(row.material.materials[input.language]).find(s=>s.length>=40&&sent?.text?.includes(s));
  if(account?.id!==row.opportunityId||!email||sent?.id!==input.messageId||!sent.sent||sent.from!==sender||!addresses(sent.to).includes(email)||sent.automatic||!fragment||!sent.threadId||!Number.isFinite(Date.parse(sent.receivedAt))||Date.parse(sent.receivedAt)<Date.parse(row.createdAt)||Date.parse(sent.receivedAt)>Date.parse(now())+60000)fail('MARKETING_USAGE_UNVERIFIED');
  const next={...row,usedBySales:true,marketingUse:{messageId:sent.id,threadId:sent.threadId,sentAt:sent.receivedAt,language:input.language,materialFingerprint:row.material.fingerprint,verifiedAt:now(),basis:'Actual outbound Gmail message includes a complete material passage of at least 40 characters'}};
  await updateEvent(row,next);return {success:true,eventId:row.eventId,use:next.marketingUse};
 }
 async function result(input){
  const row=await owned(input);if(!row.marketingUse)fail('MARKETING_USAGE_REQUIRED');
  if(row.marketingResult){if(row.marketingResult.messageId!==input.messageId)fail('MARKETING_RESULT_CONFLICT');return {success:true,eventId:row.eventId,reused:true,result:row.marketingResult};}
  const [account,reply]=await Promise.all([lead(row.opportunityId),message(input.messageId)]);
  const email=String(account?.fields?.['Contact Email']||'').toLowerCase();
  if(account?.id!==row.opportunityId||!email||reply?.id!==input.messageId||reply.sent||reply.automatic||reply.from!==email||!addresses(reply.to).includes(sender)||reply.threadId!==row.marketingUse.threadId||!reply.text?.trim()||!Number.isFinite(Date.parse(reply.receivedAt))||Date.parse(reply.receivedAt)<=Date.parse(row.marketingUse.sentAt)||Date.parse(reply.receivedAt)>Date.parse(now())+60000)fail('MARKETING_RESULT_UNVERIFIED');
  const next={...row,commercialResult:'CUSTOMER_REPLY_VERIFIED',marketingResult:{status:'CUSTOMER_REPLY_VERIFIED',messageId:reply.id,receivedAt:reply.receivedAt,verifiedAt:now(),saleInferred:false}};
  await updateEvent(row,next);return {success:true,eventId:row.eventId,result:next.marketingResult};
 }
 async function metrics(){const rows=(await listEvents()).filter(r=>r?.material);return {owner:'MARKETING',requested:rows.length,prepared:rows.length,accepted:rows.filter(r=>r.marketingReview?.status==='ACCEPTED').length,used:rows.filter(r=>r.marketingUse&&r.usedBySales).length,resultsVerified:rows.filter(r=>r.marketingResult?.status==='CUSTOMER_REPLY_VERIFIED').length,pendingAcceptance:rows.filter(r=>!r.marketingReview).length,pendingUse:rows.filter(r=>r.marketingReview&&!r.marketingUse).length,saleInferred:false};}
 async function reconcile(input){
  let row=await owned(input);if(!row.marketingReview)fail('MARKETING_ACCEPTANCE_REQUIRED');
  if(!search||!thread)fail('MARKETING_HISTORY_UNAVAILABLE');
  const account=await lead(row.opportunityId),email=String(account?.fields?.['Contact Email']||'').toLowerCase();
  if(account?.id!==row.opportunityId||!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email))fail('MARKETING_CONTACT_UNVERIFIED');
  const candidates=await search(`in:sent to:${email} after:${Math.floor(Date.parse(row.createdAt)/1000)}`);
  if(candidates.length>30)fail('MARKETING_HISTORY_REVIEW_REQUIRED');
  for(const candidate of candidates){
   if(row.marketingUse)break;
   const sent=await message(candidate.id);
   for(const language of ['es','en']){
    if(!strings(row.material.materials[language]).some(s=>s.length>=40&&sent?.text?.includes(s)))continue;
    await use({...input,messageId:candidate.id,language});row=await owned(input);break;
   }
  }
  if(row.marketingUse&&!row.marketingResult){
   const replies=(await thread(row.marketingUse.threadId)).filter(m=>!m.sent&&!m.automatic&&m.from===email&&Date.parse(m.receivedAt)>Date.parse(row.marketingUse.sentAt)).sort((a,b)=>Date.parse(a.receivedAt)-Date.parse(b.receivedAt));
   if(replies[0]){await result({...input,messageId:replies[0].id});row=await owned(input);}
  }
  const checked={...row,marketingHistoryCheck:{checkedAt:now(),candidateMessages:candidates.length,status:row.marketingResult?'CUSTOMER_REPLY_VERIFIED':row.marketingUse?'WAITING_CUSTOMER_REPLY':'NO_VERIFIED_USE',sendingPerformed:false}};
  await updateEvent(row,checked);return {success:true,eventId:row.eventId,...checked.marketingHistoryCheck,used:!!row.marketingUse,resultVerified:!!row.marketingResult,saleInferred:false};
 }
 return {review,use,result,metrics,reconcile};
}

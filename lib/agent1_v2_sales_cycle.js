// Agent 1 V2: deterministic sales-conversation decision engine.
// Produces next actions; no unverified autonomous external sends.
export function classifySalesReply({text='',unsubscribed=false,bounced=false}={}){
 const s=String(text).toLowerCase();
 if(bounced)return {stage:'BLOCKED',action:'SUPPRESS',reason:'BOUNCE'};
 if(unsubscribed||/^(?:no|stop)[.!\s]*$/i.test(s.trim())||/\b(unsubscribe|remove me|stop emailing|do not contact|no me escriban)\b/i.test(s))return {stage:'BLOCKED',action:'SUPPRESS',reason:'OPT_OUT'};
 if(!s.trim())return {stage:'WAITING',action:'NONE'};
 if(/\b(not interested|no thanks|not now|no interesado)\b/i.test(s))return {stage:'LOST',action:'STOP_SEQUENCE'};
 if(/\b(quote|proposal|pricing|cost|price|cotizaci[oó]n|precio)\b/i.test(s))return {stage:'ENGAGED',action:'PREPARE_SCOPE_QUESTIONS'};
 if(/\b(yes|interested|schedule|meeting|demo|interesado|reuni[oó]n)\b/i.test(s))return {stage:'ENGAGED',action:'PREPARE_SCOPE_QUESTIONS'};
 return {stage:'REVIEW',action:'HUMAN_REVIEW'};
}
// No historical price, discount or payment terms imply owner authorization.
export function quotePilot({scopeAccepted=false,discountPercent=0,approvedQuote=null}={}){
 if(!Number.isFinite(discountPercent)||discountPercent<0)throw Error('DISCOUNT_NOT_AUTHORIZED');
 const valid=approvedQuote?.ownerApproved===true&&Boolean(approvedQuote?.approvalId)&&
  Number.isFinite(approvedQuote?.amount)&&approvedQuote.amount>0&&approvedQuote.currency==='USD'&&
  Number.isFinite(approvedQuote?.maxDiscountPercent)&&approvedQuote.maxDiscountPercent>=0&&approvedQuote.maxDiscountPercent<=100&&
  Number.isFinite(approvedQuote?.upfrontPercent)&&approvedQuote.upfrontPercent>=0&&approvedQuote.upfrontPercent<=100;
 if(!valid)return {currency:'USD',base:null,total:null,upfront:null,completion:null,scopeAccepted,readyToOffer:false,requiresApproval:true,paymentRequested:false};
 if(discountPercent>approvedQuote.maxDiscountPercent)throw Error('DISCOUNT_NOT_AUTHORIZED');
 const total=Math.round(approvedQuote.amount*(1-discountPercent/100)*100)/100;
 const upfront=Math.round(total*approvedQuote.upfrontPercent)/100;
 return {currency:'USD',approvalId:approvedQuote.approvalId,base:approvedQuote.amount,discountPercent,total,upfront,completion:Math.round((total-upfront)*100)/100,scopeAccepted,readyToOffer:scopeAccepted,requiresApproval:!scopeAccepted,paymentRequested:false};
}
export function nextSalesAction({stage,reply,scopeAccepted=false}={}){
 if(['BLOCKED','LOST','WON'].includes(stage))return {action:'NONE'};
 const classified=classifySalesReply({text:reply});
 if(['SUPPRESS','STOP_SEQUENCE'].includes(classified.action))return classified;
 if(classified.action==='PREPARE_SCOPE_QUESTIONS')return {...classified,questions:['Which workflow needs automation?','Current volume and tools?','Who approves the scope?','Desired implementation date?']};
 if(scopeAccepted)return {stage:'PROPOSED',action:'REQUEST_EXPLICIT_ACCEPTANCE'};
 return classified;
}

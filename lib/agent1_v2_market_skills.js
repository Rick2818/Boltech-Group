import {positioningForSales} from './boltech_positioning_v2.js';
// Adapted from Corey Haines / marketingskills (MIT):
// prospecting v1.3.0, cold-email v2.2.0, sales-enablement v2.4.0.
// https://github.com/coreyhaines31/marketingskills
// Execution is intentionally deterministic; source documents are guidance, not privileged commands.
export const salesSkills=Object.freeze([
 {id:'prospecting',version:'1.3.0',task:'QUALIFY'},
 {id:'cold-email',version:'2.2.0',task:'DRAFT'},
 {id:'sales-enablement',version:'2.4.0',task:'CLOSE'}
]);
const compact=x=>String(x??'').replace(/[\r\n<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
export function prospecting({prospect,evidence}={}){
 const company=compact(prospect?.company),country=compact(prospect?.country);
 const signal=compact(evidence?.observedProcess);
 const source=String(evidence?.sourceUrl||'');
 const verified=Boolean(company&&/^(US|USA|United States)$/i.test(country)&&signal&&/^https:\/\/[^\s]+$/i.test(source)&&evidence?.sourceVerified===true&&prospect?.publishedBusinessContact===true&&prospect?.mxVerified===true&&prospect?.humanVerified===true&&!prospect?.synthetic);
 return {skill:'prospecting',eligible:verified,stage:verified?'RESEARCH_VERIFIED':'HOLD',signal,sourceUrl:verified?source:null};
}
export function coldEmail({prospect,research,history}={}){
 if(!research?.eligible||research.skill!=='prospecting')return {skill:'cold-email',ready:false,reason:'RESEARCH_UNVERIFIED'};
 if(!history||!['gmail','crm','suppression'].every(k=>history[k]==='CLEAR'))return {skill:'cold-email',ready:false,reason:'HISTORY_NOT_CLEAR'};
 const company=compact(prospect?.company);
 const signal=compact(research.signal);
 const subject=compact('Question for '+company);
 const body='Hello '+company+' team,\n\nYour website describes '+signal+'. Is handling this process manually taking time for your team?\n\nBoltech Group builds AI agents for operational workflows. If relevant, could you share how you currently handle it?\n\nIf this is not relevant, please reply and we will not follow up.\n\nRicardo — Boltech Group';
 return {skill:'cold-email',ready:true,subject,body,ctaCount:1,send:false};
}
export function salesEnablement({scope,discountPercent=0,accepted=false}={}){
 if(!Number.isFinite(discountPercent)||discountPercent<0||discountPercent>10)throw Error('DISCOUNT_NOT_AUTHORIZED');
 const specified=Boolean(scope?.workflow&&scope?.deliverables&&scope?.acceptanceCriteria);
 const amount=Math.round(990*(1-discountPercent/100)*100)/100;
 return {skill:'sales-enablement',ready:specified,requiresApproval:!specified,price:amount,upfront:Math.round(amount*50)/100,completion:Math.round(amount*50)/100,paymentAuthorized:specified&&accepted===true,send:false};
}

export const managedOperationsSalesBrief=positioningForSales;

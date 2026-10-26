import {canonicalCommercialDraft} from './commercial_verifier_v2.js';
// Explicit business policy for US commercial outreach. It does NOT infer
// authorization from a published mailbox or the legacy approval booleans.
export function getCommercialV2Compliance(env={}){
 const postal=String(env.COMMERCIAL_V2_POSTAL_ADDRESS||'').trim();
 const authorized=env.COMMERCIAL_V2_AUTONOMOUS_AUTHORIZED==='true';
 const verifiedPostal=env.COMMERCIAL_V2_POSTAL_ADDRESS_VERIFIED==='true'&&postal.length>=16&&!/[\r\n]/.test(postal);
 return {authorized,verifiedPostal,postal:verifiedPostal?postal:null};
}
export async function evaluateCommercialV2Policy(lead,{env={}}={}){
 const flags=getCommercialV2Compliance(env);
 const draft=canonicalCommercialDraft(lead)||{};
 const market=String(lead?.country||'').trim().toUpperCase();
 const target=market==='US'&&lead?.source_payload?.doNotContact!==true&&
  !/QA|SYNTHETIC|TEST/i.test(String(lead?.data_quality||''))&&
  Boolean(draft.subject&&draft.body&&draft.marketingContentId);
 return {
  policyId:'BOLTECH-US-B2B-AUTONOMOUS-V2-20261023',
  eligible:target&&flags.verifiedPostal,
  authorized:flags.authorized&&flags.verifiedPostal
 };
}
export function commercialV2BodyWithFooter(body,{env={}}={}){
 const flags=getCommercialV2Compliance(env);
 if(!flags.authorized||!flags.verifiedPostal)throw Error('V2_COMPLIANCE_NOT_CONFIGURED');
 const text=String(body||'').trim();
 if(text.length<30)throw Error('V2_INVALID_COMMERCIAL_COPY');
 return text+'\n\nCommercial message from Boltech Group. To stop future commercial emails, reply UNSUBSCRIBE to this email.\nPostal address: '+flags.postal;
}

// Bounded public assistant tool executor. No side effects, customer credentials or outbounds.
import { getWhatsAppStatus } from './whatsapp_engine.js';

export const LEO_READ_TOOLS=Object.freeze({
  catalog: Object.freeze({description:'Read Boltech public product and indicative prices',readOnly:true}),
  whatsapp_readiness: Object.freeze({description:'Inspect Boltech WhatsApp provider configuration without sending messages',readOnly:true})
});
export async function executeLeoReadTool(name,{statusProvider=getWhatsAppStatus}={}){
  if(!Object.hasOwn(LEO_READ_TOOLS,name))throw Object.assign(Error('LEO_TOOL_NOT_ALLOWED'),{statusCode:403});
  if(name==='catalog')return {ok:true,tool:name,receipt:'catalog:v1',data:{pilotUSD:600,pilotScope:'one workflow and one simple integration',customFromUSD:900,quotationRequired:true}};
  const s=await statusProvider();
  return {ok:true,tool:name,receipt:'whatsapp:configuration-check',data:{
    provider:'Twilio',configured:Boolean(s?.configured),status:s?.configured?'CREDENTIALS_PRESENT_UNVERIFIED':'CREDENTIALS_MISSING',
    ownerAuthorizationVerified:false,messageSent:false,
    note:'Credentials alone do not prove approved WhatsApp Business onboarding or authorization.'
  }};
}
export function parseLeoToolDecision(text){
  const match=String(text||'').match(/\{[\s\S]*\}/);
  if(!match)return null;
  let obj;try{obj=JSON.parse(match[0])}catch{return null}
  if(!obj||obj.action!=='read_tool'||!Object.hasOwn(LEO_READ_TOOLS,obj.tool))return null;
  return {tool:obj.tool};
}
export async function executeLeoDecision(text,options={}){
 const decision=parseLeoToolDecision(text);
 if(!decision)return null;
 return executeLeoReadTool(decision.tool,options);
}

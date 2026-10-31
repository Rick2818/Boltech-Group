import crypto from 'node:crypto';
import {requireOperationalAuth} from './operational_auth.js';

// WhatsApp Business App Coexistence requires Meta Embedded Signup; environment
// keys are supplied only after owner-authorized onboarding. No app migration.
const env=()=>({
 token:process.env.META_WA_ACCESS_TOKEN||'',
 phone:process.env.META_WA_PHONE_NUMBER_ID||'',
 verify:process.env.META_WA_VERIFY_TOKEN||'',
 secret:process.env.META_WA_APP_SECRET||'',
 version:process.env.META_GRAPH_API_VERSION||'v23.0'
});
const eq=(x,y)=>{const a=Buffer.from(String(x)),b=Buffer.from(String(y));return a.length===b.length&&crypto.timingSafeEqual(a,b)};
export function metaWhatsAppReadiness(settings=env()){
 const required=['token','phone','verify','secret'];
 const missing=required.filter(k=>!settings[k]);
 return {provider:'Meta Cloud API',mode:'COEXISTENCE_PENDING_OWNER_ONBOARDING',
 configured:missing.length===0,missing:missing.map(k=>({token:'META_WA_ACCESS_TOKEN',phone:'META_WA_PHONE_NUMBER_ID',verify:'META_WA_VERIFY_TOKEN',secret:'META_WA_APP_SECRET'})[k]),
 // Credentials do not establish that the number has completed coexistence onboarding.
 certified:false,canSend:false};
}
export function metaWebhookSignatureValid(raw,header,secret){
 if(!secret||!Buffer.isBuffer(raw)||!/^sha256=[a-f0-9]{64}$/i.test(String(header||'')))return false;
 const expected='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
 return eq(header,expected);
}
export async function handleMetaWhatsApp(req,res){
 res.setHeader('Cache-Control','no-store');
 const e=env();
 if(req.method==='GET'){
  const q=req.query||{};
  if(q['hub.mode']==='subscribe'){
   if(!e.verify||!eq(q['hub.verify_token']||'',e.verify))return res.status(403).end();
   return res.status(200).send(String(q['hub.challenge']||''));
  }
  if(!requireOperationalAuth(req,res))return;
  return res.status(200).json(metaWhatsAppReadiness(e));
 }
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 // This endpoint is webhook-only: no outbound message can be initiated publicly.
 const raw=Buffer.isBuffer(req.rawBody)?req.rawBody:null;
 if(!metaWebhookSignatureValid(raw,req.headers['x-hub-signature-256'],e.secret))
   return res.status(403).json({error:'INVALID_META_SIGNATURE'});
 // Accept authenticated notifications only; do not auto-answer or store sensitive messages yet.
 return res.status(200).json({received:true,automatedReply:false});
}

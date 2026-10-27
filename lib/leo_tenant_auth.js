// Tenant credentials are issued by a trusted provisioning service, never by the web visitor.
// Verify HMAC before binding a tenant to Leo; fail closed if the secret is missing.
import crypto from 'node:crypto';
const failure=()=>{throw Object.assign(new Error('LEO_AUTH_UNVERIFIED'),{statusCode:401})};
const valid=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{3,100}$/.test(x);
export function verifyLeoTenantToken(token,{secret=process.env.LEO_TENANT_TOKEN_SECRET,now=Date.now()}={}){
 if(typeof secret!=='string'||secret.length<32||typeof token!=='string'||token.length>4096)failure();
 const parts=token.split('.');if(parts.length!==2)failure();
 const [body,signature]=parts;
 if(!/^[A-Za-z0-9_-]+$/.test(body)||!/^[A-Za-z0-9_-]+$/.test(signature))failure();
 const expected=crypto.createHmac('sha256',secret).update(body).digest('base64url');
 const a=Buffer.from(signature),b=Buffer.from(expected);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))failure();
 let payload;try{payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'))}catch{failure()}
 if(payload?.aud!=='leo-factory-v1'||!valid(payload.tenantId)||!valid(payload.subject)||!Number.isSafeInteger(payload.exp)||payload.exp<=Math.floor(now/1000)||payload.exp>Math.floor(now/1000)+86400)failure();
 if(payload.roles!==undefined&&(!Array.isArray(payload.roles)||payload.roles.some(x=>!['tenant_admin','tenant_operator'].includes(x))))failure();
 return Object.freeze({verified:true,tenantId:payload.tenantId,subject:payload.subject,roles:payload.roles||[]});
}

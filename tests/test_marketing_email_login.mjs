import test from 'node:test';
import assert from 'node:assert/strict';
import {handleMarketingLogin,requireMarketingSession} from '../lib/marketing_passwordless_auth.js';
class RedisMock{
 constructor(){this.map=new Map();}
 async get(k){return this.map.get(k)??null;}
 async set(k,v){this.map.set(k,v);return 'OK';}
 async del(k){return this.map.delete(k)?1:0;}
 async getdel(k){const v=await this.get(k);await this.del(k);return v;}
 async incr(k){const v=Number(this.map.get(k)||0)+1;this.map.set(k,v);return v;}
 async expire(){return 1;}
}
function res(){return {code:200,headers:{},payload:null,setHeader(k,v){this.headers[k]=v;return this;},status(v){this.code=v;return this;},json(v){this.payload=v;return this;}};}
const headers={host:'boltech-group.vercel.app',origin:'https://boltech-group.vercel.app','x-real-ip':'192.0.2.9'};
const env={SMTP_USER:'owner@example.test'};
test('owner email code is sent only to the configured owner and creates an HttpOnly cookie',async()=>{
 const redis=new RedisMock(),mail=[];
 const send=async payload=>{mail.push(payload);return {acceptedByProvider:true}};
 const deps={redis,env,send};
 const first=res();
 await handleMarketingLogin({method:'POST',headers,body:{action:'request',to:'attacker@other.test'}},first,deps);
 assert.equal(first.code,200);assert.ok(first.payload.challenge);
 assert.equal(mail[0].to,env.SMTP_USER);
 const code=mail[0].text.match(/\b\d{6}\b/)[0];
 const second=res();
 await handleMarketingLogin({method:'POST',headers,body:{action:'verify',challenge:first.payload.challenge,code}},second,deps);
 assert.equal(second.code,200);assert.equal(second.payload.authenticated,true);
 const cookie=second.headers['Set-Cookie'];
 assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);assert.doesNotMatch(cookie,/Bearer/);
 const storedCookie=cookie.split(';')[0];const check=res();
 assert.equal(await requireMarketingSession({headers:{cookie:storedCookie}},check,{redis}),true);
 const reuse=res();
 await handleMarketingLogin({method:'POST',headers,body:{action:'verify',challenge:first.payload.challenge,code}},reuse,deps);
 assert.equal(reuse.code,401);
 const logout=res();
 await handleMarketingLogin({method:'POST',headers:{...headers,cookie:storedCookie},body:{action:'logout'}},logout,deps);
 assert.equal(logout.code,200);
 const after=res();
 assert.equal(await requireMarketingSession({headers:{cookie:storedCookie}},after,{redis}),false);
 assert.equal(after.code,401);
});
test('cross-site login requests fail, unauthorized read is denied, SMTP failure does not grant access',async()=>{
 const redis=new RedisMock(),deps={redis,env,send:async()=>({acceptedByProvider:false})};
 const cross=res();
 await handleMarketingLogin({method:'POST',headers:{...headers,origin:'https://attacker.example'},body:{action:'request'}},cross,deps);
 assert.equal(cross.code,403);
 const fail=res();
 await handleMarketingLogin({method:'POST',headers,body:{action:'request'}},fail,deps);
 assert.equal(fail.code,503);assert.equal(fail.payload.error,'LOGIN_EMAIL_NOT_SENT');
 const denied=res();
 assert.equal(await requireMarketingSession({headers:{}},denied,{redis}),false);
});

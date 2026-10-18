import { randomBytes, createHash, hkdfSync, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

export const UPWORK_CALLBACK_URL = 'https://boltech-group.vercel.app/api/upwork/callback';
export const UPWORK_TOKEN_KEY = 'boltech:upwork:oauth:v1';
const AUTH_URL = 'https://www.upwork.com/ab/account-security/oauth2/authorize';
const TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';
const COOKIE = '__Host-boltech_upwork_oauth';
const digest = value => createHash('sha256').update(value).digest('hex');
const tokenKey = secret => Buffer.from(hkdfSync('sha256', secret, 'boltech.upwork.oauth.v1', 'token-vault', 32));

export function encryptUpworkTokens(tokens, secret) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', tokenKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return { version:1, iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64'), ciphertext:ciphertext.toString('base64') };
}
export function decryptUpworkTokens(value, secret) {
  if (value?.version !== 1) throw new Error('UPWORK_VAULT_VERSION');
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(secret), Buffer.from(value.iv,'base64'));
  decipher.setAuthTag(Buffer.from(value.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext,'base64')), decipher.final()]).toString('utf8'));
}

// Dependencies are injected for isolated tests; production must supply durable Redis, never RAM fallback.
export function createUpworkOAuthHandler({ getRedis, requireAuth, env=()=>process.env, fetchFn=fetch, now=Date.now }) {
  return async function handleUpworkOAuth(req,res,action='callback') {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    const fail=(status,code)=>res.status(status).json({success:false,code});
    const config=env();
    const clientId=String(config.UPWORK_CLIENT_ID||'').trim();
    const clientSecret=String(config.UPWORK_CLIENT_SECRET||'').trim();
    const configured=Boolean(clientId && clientSecret);
    const query=new URL(req.url,UPWORK_CALLBACK_URL).searchParams;
    if (action==='callback' && req.method==='GET' && !['code','state','error'].some(k=>query.has(k))) {
      return res.status(200).json({success:true,code:'UPWORK_CALLBACK_READY',callbackUrl:UPWORK_CALLBACK_URL,credentialsConfigured:configured,agent1Connected:false});
    }
    if (action==='start') {
      if(req.method!=='POST') { res.setHeader('Allow','POST'); return fail(405,'METHOD_NOT_ALLOWED'); }
      if(!requireAuth(req,res)) return;
    } else if(action!=='callback' || req.method!=='GET') {
      res.setHeader('Allow','GET'); return fail(405,'METHOD_NOT_ALLOWED');
    }
    if(!configured) return fail(503,'UPWORK_CLIENT_CREDENTIALS_MISSING');
    try {
      const redis=getRedis();
      if(!redis) return fail(503,'UPWORK_DURABLE_STORE_REQUIRED');
      if(action==='start') {
        if(await redis.get(UPWORK_TOKEN_KEY)) return fail(409,'UPWORK_ALREADY_LINKED');
        const state=randomBytes(32).toString('base64url'), binding=randomBytes(32).toString('base64url');
        const record={bindingHash:digest(binding),issuedAt:now(),redirectUri:UPWORK_CALLBACK_URL};
        if(await redis.set('boltech:upwork:state:'+digest(state),record,{ex:600,nx:true})!=='OK') return fail(503,'UPWORK_STATE_NOT_SAVED');
        res.setHeader('Set-Cookie',`${COOKIE}=${binding}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`);
        const url=new URL(AUTH_URL);
        for(const [key,value] of Object.entries({response_type:'code',client_id:clientId,redirect_uri:UPWORK_CALLBACK_URL,state})) url.searchParams.set(key,value);
        return res.status(200).json({success:true,authorizationUrl:url.href,expiresIn:600});
      }
      if(query.getAll('state').length!==1 || query.getAll('code').length>1 || query.getAll('error').length>1) return fail(400,'UPWORK_STATE_INVALID');
      const state=query.get('state')||'';
      const cookies=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
      const binding=cookies.length===1 ? cookies[0].slice(COOKIE.length+1) : '';
      if(!/^[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(binding)) return fail(400,'UPWORK_STATE_INVALID');
      const stateKey='boltech:upwork:state:'+digest(state);
      const record=await redis.get(stateKey);
      if(!record || typeof record.bindingHash!=='string' || !/^[a-f0-9]{64}$/.test(record.bindingHash) ||
        !Number.isFinite(record.issuedAt) || now()-record.issuedAt<0 || now()-record.issuedAt>600000 ||
        record.redirectUri!==UPWORK_CALLBACK_URL || !timingSafeEqual(Buffer.from(record.bindingHash),Buffer.from(digest(binding)))) return fail(400,'UPWORK_STATE_INVALID');
      // Atomic consumption prevents parallel callback replays. Do not emulate with GET then DEL.
      if(!await redis.getdel(stateKey)) return fail(400,'UPWORK_STATE_ALREADY_USED');
      res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);
      if(query.has('error')) return fail(400,'UPWORK_AUTHORIZATION_DECLINED');
      const code=query.get('code')||'';
      if(!code || code.length>2048 || /[\x00-\x1f]/.test(code)) return fail(400,'UPWORK_CODE_INVALID');
      const body=new URLSearchParams({grant_type:'authorization_code',code,client_id:clientId,client_secret:clientSecret,redirect_uri:UPWORK_CALLBACK_URL});
      let response;
      try { response=await fetchFn(TOKEN_URL,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body}); }
      catch { return fail(502,'UPWORK_TOKEN_EXCHANGE_FAILED'); }
      if(!response.ok) return fail(502,'UPWORK_TOKEN_EXCHANGE_FAILED');
      let data;
      try { data=await response.json(); } catch { return fail(502,'UPWORK_TOKEN_RESPONSE_INVALID'); }
      if(!data || typeof data!=='object' || typeof data.access_token!=='string' || !data.access_token || data.access_token.length>16384 ||
        typeof data.refresh_token!=='string' || !data.refresh_token || data.refresh_token.length>16384 ||
        (data.token_type && String(data.token_type).toLowerCase()!=='bearer')) return fail(502,'UPWORK_TOKEN_RESPONSE_INVALID');
      const stored={access_token:data.access_token,refresh_token:data.refresh_token,token_type:'Bearer',storedAt:new Date(now()).toISOString()};
      if(Number.isFinite(Number(data.expires_in)) && Number(data.expires_in)>0) stored.expiresAt=now()+Number(data.expires_in)*1000;
      if(await redis.set(UPWORK_TOKEN_KEY,encryptUpworkTokens(stored,clientSecret),{nx:true})!=='OK') return fail(409,'UPWORK_TOKEN_NOT_STORED_REAUTHORIZE');
      return res.status(200).json({success:true,code:'UPWORK_OAUTH_TOKENS_STORED',agent1Connected:false,nextAction:'VERIFY_READ_ONLY_DISCOVERY_ADAPTER'});
    } catch { return fail(503,'UPWORK_AUTH_STORAGE_UNAVAILABLE'); }
  };
}

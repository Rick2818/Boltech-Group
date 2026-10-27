import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {verifyLeoTenantToken} from '../lib/leo_tenant_auth.js';
import {handleLeoObjective} from '../lib/leo_objectives_http.js';
const secret='x'.repeat(40), now=1793120000000;
function token(claims){const body=Buffer.from(JSON.stringify(claims)).toString('base64url');return body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url')}
const claims={aud:'leo-factory-v1',tenantId:'company_boltech',subject:'buyer_001',exp:Math.floor(now/1000)+1000};
test('valid signed tenant token binds server identity',()=>{assert.equal(verifyLeoTenantToken(token(claims),{secret,now}).tenantId,'company_boltech')});
test('tampered token, expired and wrong audience rejected',()=>{for(const t of [token({...claims,tenantId:'company_other'})+'x',token({...claims,exp:1}),token({...claims,aud:'other'})])assert.throws(()=>verifyLeoTenantToken(t,{secret,now}),/LEO_AUTH_UNVERIFIED/)});
test('unauthenticated public API cannot create objectives',async()=>{let code=0,result;const res={setHeader(){},status(x){code=x;return this},json(x){result=x;return this}};await handleLeoObjective({method:'POST',headers:{},body:{operation:'create',objective:{}}},res,{store:{}});assert.equal(code,401);assert.equal(result.error,'LEO_AUTH_UNVERIFIED')});

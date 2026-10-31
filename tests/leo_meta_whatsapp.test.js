import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {metaWebhookSignatureValid,metaWhatsAppReadiness} from '../lib/leo_meta_whatsapp.js';
test('Meta webhook rejects missing or malformed signatures',()=>{
 const raw=Buffer.from('{"entry":[]}');
 assert.equal(metaWebhookSignatureValid(raw,'','secret'),false);
 assert.equal(metaWebhookSignatureValid(raw,'sha256=bad','secret'),false);
 assert.equal(metaWebhookSignatureValid(null,'sha256='+'0'.repeat(64),'secret'),false);
});
test('Meta webhook accepts only matching signed raw body',()=>{
 const raw=Buffer.from('{"entry":[]}'),secret='secret';
 const header='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(metaWebhookSignatureValid(raw,header,secret),true);
 assert.equal(metaWebhookSignatureValid(Buffer.from('{"entry":[1]}'),header,secret),false);
});
test('Missing registration credentials remain uncertified',()=>{
 const state=metaWhatsAppReadiness({token:'',phone:'',verify:'',secret:''});
 assert.equal(state.configured,false);assert.equal(state.certified,false);assert.equal(state.canSend,false);
 assert.equal(state.missing.length,4);
});

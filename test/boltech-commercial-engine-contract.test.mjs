import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Boltech commercial engine uses the existing protected partner API', () => {
 const source = readFileSync(new URL('../api/partners.js',import.meta.url),'utf8');
 assert.match(source,/if\(action==='commercial-engine-status'\)/);
 assert.match(source,/if\(!requireOperationalAuth\(req,res\)\)return/);
 assert.match(source,/engine:'Boltech Commercial Engine'/);
 assert.match(source,/legacyPartnerApiPreserved:true/);
 assert.match(source,/autonomousOutreachCertified:false/);
 assert.match(source,/endToEndPaymentCertified:false/);
 assert.match(source,/if\(action==='commercial-activation'\)/);
 assert.match(source,/createRsi02InboxExecutor\(\)\.run\(\)/);
 assert.match(source,/createDailyLeadExecutor\(\)\.run\(\)/);
});

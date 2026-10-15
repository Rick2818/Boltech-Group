import test from 'node:test';
import assert from 'node:assert/strict';
import { routeCommercialIntake, CHANNELS } from '../lib/commercial_intake_router.js';
for (const channel of CHANNELS) {
  test('synthetic intake routes safely across '+channel, () => {
    const base={channel,synthetic:true,consent:true,contactValidated:true};
    assert.equal(routeCommercialIntake({...base,intent:'general'}).targetRole,'RSI-01');
    assert.equal(routeCommercialIntake({...base,intent:'custom_quote'}).targetRole,'RSI-02');
    assert.equal(routeCommercialIntake({...base,intent:'prebuilt_quote',scopeComplete:true}).targetRole,'RSI-03');
    assert.equal(routeCommercialIntake({...base,intent:'prebuilt_quote'}).targetRole,'RSI-02');
    assert.equal(routeCommercialIntake({...base,intent:'accepted_quote',quoteApproved:true,quoteVerified:true}).targetRole,'RSI-03');
    assert.equal(routeCommercialIntake({...base,intent:'accepted_quote',quoteApproved:true}).targetRole,'RSI-02');
    assert.equal(routeCommercialIntake({...base,intent:'custom_quote'}).quoteIssueAllowed,false);
    assert.equal(routeCommercialIntake({...base,intent:'prebuilt_quote',scopeComplete:true}).paymentAllowed,false);
    assert.equal(routeCommercialIntake({...base,intent:'general',outreachAuthorized:true}).outreachAllowed,true);
    assert.equal(routeCommercialIntake({...base,intent:'general',outreachAuthorized:true,consent:false}).outreachAllowed,false);
    assert.equal(routeCommercialIntake({...base,intent:'general',outreachAuthorized:true,contactValidated:false}).outreachAllowed,false);
  });
}
test('fails closed on unsupported channel and malformed input', () => {
 assert.throws(()=>routeCommercialIntake(null),/INVALID_INTAKE/);
 assert.throws(()=>routeCommercialIntake({channel:'unknown'}),/UNSUPPORTED_CHANNEL/);
});

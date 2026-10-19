import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignLandingUrl,validatedCampaignAttribution,marketingPublicationReceipt,INSTITUTIONAL_LINKEDIN_ORG} from '../lib/marketing_distribution.js';

test('campaign links include usable LinkedIn attribution',()=>{
 const u=new URL(campaignLandingUrl('CUSTOM_AGENTS'));
 assert.equal(u.searchParams.get('utm_campaign'),'custom_agents');
 assert.deepEqual(validatedCampaignAttribution({utm_campaign:u.searchParams.get('utm_campaign'),utm_medium:u.searchParams.get('utm_medium'),utm_source:u.searchParams.get('utm_source')}),{campaignId:'CUSTOM_AGENTS',source:'linkedin',medium:'organic_social',status:'SELF_REPORTED_FORM_ATTRIBUTION',verifiedVisit:false});
 assert.equal(validatedCampaignAttribution({utm_campaign:'other',utm_medium:'organic_social',utm_source:'linkedin'}),null);
});
test('publishing evidence excludes personal LinkedIn and non-public records',()=>{
 assert.throws(()=>marketingPublicationReceipt({network:'linkedin',organization:'urn:li:person:ricbol',campaignId:'CUSTOM_AGENTS',providerId:'1',publicUrl:'https://www.linkedin.com/feed/update/xyz',status:'PUBLISHED'}),/INSTITUTIONAL_IDENTITY/);
 assert.throws(()=>marketingPublicationReceipt({network:'linkedin',organization:INSTITUTIONAL_LINKEDIN_ORG,campaignId:'CUSTOM_AGENTS',providerId:'1',status:'SCHEDULED'}),/UNVERIFIED/);
 assert.equal(marketingPublicationReceipt({network:'linkedin',organization:INSTITUTIONAL_LINKEDIN_ORG,campaignId:'CUSTOM_AGENTS',providerId:'1',publicUrl:'https://www.linkedin.com/feed/update/xyz',status:'PUBLISHED'}).status,'PUBLISHED');
});

// Campaign identifiers and attribution are validated separately from customer identity.
export const MARKETING_CAMPAIGNS=Object.freeze(['CUSTOM_AGENTS','PREBUILT_AGENTS']);
export const INSTITUTIONAL_LINKEDIN_ORG='urn:li:organization:146617304';
export function campaignLandingUrl(campaignId,base='https://boltech-group.vercel.app/'){
 if(!MARKETING_CAMPAIGNS.includes(campaignId))throw Error('MARKETING_CAMPAIGN_INVALID');
 const u=new URL(base);if(u.protocol!=='https:')throw Error('MARKETING_URL_INVALID');
 u.searchParams.set('utm_source','linkedin');
 u.searchParams.set('utm_medium','organic_social');
 u.searchParams.set('utm_campaign',campaignId.toLowerCase());
 return u.toString();
}
export function validatedCampaignAttribution(input={}){
 if(!input||typeof input!=='object')return null;
 const campaign=String(input.utm_campaign||'').toUpperCase();
 if(!MARKETING_CAMPAIGNS.includes(campaign))return null;
 if(input.utm_source!=='linkedin'||input.utm_medium!=='organic_social')return null;
 return {campaignId:campaign,source:'linkedin',medium:'organic_social',status:'SELF_REPORTED_FORM_ATTRIBUTION',verifiedVisit:false};
}
export function marketingPublicationReceipt(item){
 if(!item||item.network!=='linkedin'||item.organization!==INSTITUTIONAL_LINKEDIN_ORG)
  throw Error('MARKETING_INSTITUTIONAL_IDENTITY_REQUIRED');
 if(!MARKETING_CAMPAIGNS.includes(item.campaignId))throw Error('MARKETING_CAMPAIGN_INVALID');
 if(!item.providerId||!item.publicUrl||!/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\//i.test(item.publicUrl))
  throw Error('MARKETING_PUBLICATION_UNVERIFIED');
 if(item.status!=='PUBLISHED')throw Error('MARKETING_PUBLICATION_NOT_CONFIRMED');
 return {campaignId:item.campaignId,network:'linkedin',providerId:String(item.providerId),publicUrl:item.publicUrl,status:'PUBLISHED'};
}

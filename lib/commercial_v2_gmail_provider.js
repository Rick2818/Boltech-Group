// Adapter for the existing authorized SDR Gmail mailbox. No new account/integration.
import {createSdrGmail,SDR_SENDER} from './sdr_gmail.js';
export function commercialV2GmailProvider({gmail=createSdrGmail(),campaigns}={}){
 if(typeof campaigns!=='function')throw Error('V2_CAMPAIGN_LOOKUP_REQUIRED');
 const identifier=key=>'<v2-'+key+'@boltech-group.vercel.app>';
 return {
  async send({recipient,campaignId,key}){
   const draft=await campaigns(campaignId);
   if(!draft||draft.recipient?.trim().toLowerCase()!==recipient.toLowerCase()||
      !draft.subject||!draft.text||!draft.approved)
     throw Error('V2_CAMPAIGN_NOT_AUTHORIZED');
   // Caller's durable CAS reservation MUST exist before reaching this adapter.
   const result=await gmail.send({email:recipient,subject:draft.subject,text:draft.text,rfcMessageId:identifier(key)});
   return {id:result.messageId,threadId:result.threadId};
  },
  async lookup(key,entry){
   // Gmail search results alone are insufficient: examine the actual sent RFC Message-ID.
   const id=identifier(key);
   const matches=await gmail.search('in:sent rfc822msgid:'+id);
   const verified=[];
   for(const row of matches){
    const m=await gmail.message(row.id);
    const to=String(m.to||'').toLowerCase();
    if(m.sent===true&&m.rfcMessageId===id&&to.includes(entry.recipient_email.toLowerCase())&&
       m.from===SDR_SENDER&&m.threadId) verified.push({id:m.id,threadId:m.threadId});
   }
   return verified;
  }
 };
}

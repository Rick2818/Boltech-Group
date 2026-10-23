// Server-only Supabase V2 store. Requires migration commercial_v2_dispatch.
export function createCommercialV2Store({url,key,fetcher=fetch}={}){
 if(!url||!key)throw Error('V2_SUPABASE_NOT_CONFIGURED');
 const root=url.replace(/\/$/,'')+'/rest/v1';
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
 async function request(path,{method='GET',body,extraHeaders={}}={}){
  const response=await fetcher(root+path,{method,headers:{...headers,...extraHeaders},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error('V2_STORE_HTTP_'+response.status);
  return response.json();
 }
 const transition=async(key,expected,status,proof={},failure=null)=>{
  const ok=await request('/rpc/commercial_v2_transition',{method:'POST',body:{p_key:key,p_expected:expected,p_status:status,p_message_id:proof.providerMessageId||null,p_thread_id:proof.providerThreadId||null,p_failure_code:failure}});
  if(ok!==true)throw Error('V2_INVALID_STATE_TRANSITION');
 };
 return {
  async get(key){const items=await request('/commercial_v2_dispatch?dispatch_key=eq.'+encodeURIComponent(key)+'&select=*');return items?.[0]||null;},
  async reserve({key,sender,recipient,campaignId,purpose}){
   return request('/rpc/commercial_v2_reserve',{method:'POST',body:{p_key:key,p_sender:sender,p_recipient:recipient,p_campaign:campaignId,p_purpose:purpose}});
  },
  async markSending(key){await transition(key,'RESERVED','SENDING');},
  async setUnknown(key,reason){await transition(key,'SENDING','SEND_UNKNOWN',{},reason);},
  async markSent(key,proof){
   const entry=await this.get(key);
   if(!['SENDING','SEND_UNKNOWN'].includes(entry?.status))throw Error('V2_NOT_SENDABLE');
   await transition(key,entry.status,'SENT',proof);
  }
 };
}

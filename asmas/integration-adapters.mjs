// Isolated integration interfaces for independent workers.
// Every real provider must explicitly opt in; production is disabled by default.
export const ISOLATION=Object.freeze({project:'ASMAS',testCase:'SYN-E2E-001',allowOutbound:false,allowCharge:false,allowProdDeploy:false});
export function createAdapters({db,queue,airtable,agents,providers,policy=ISOLATION}={}){
 if(!db||!queue||!airtable||!agents)throw Error('ASMAS_DEPENDENCIES_MISSING');
 return {
  db,queue,airtable,agents,
  async executeOutbound(message){
   if(!policy.allowOutbound)throw Error('OUTBOUND_DISABLED');
   if(!providers?.email?.send)throw Error('EMAIL_CONNECTOR_REQUIRED');
   return providers.email.send(message);
  },
  async charge(payment){
   if(!policy.allowCharge)throw Error('CHARGES_DISABLED');
   if(!providers?.payments?.charge)throw Error('PAYMENT_CONNECTOR_REQUIRED');
   return providers.payments.charge(payment);
  }
 };
}

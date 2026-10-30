// Separate product delivery strategies. Deliberately no external provider defaults.
const fail=code=>{throw Object.assign(new Error(code),{code});};
const ident=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,120}$/.test(x);
export function createAgentFulfillmentRouter({ledger,catalog,customFactory,activation}={}){
 if(typeof ledger?.read!=='function'||typeof catalog?.resolve!=='function'||
    typeof customFactory?.prepare!=='function'||typeof activation?.activate!=='function')
   fail('FULFILLMENT_PROVIDER_NOT_CONFIGURED');
 async function prepare({orderId,expectedVersion,customerId}={}){
   if(!ident(orderId)||!ident(customerId)||!Number.isSafeInteger(expectedVersion))fail('FULFILLMENT_INVALID_INPUT');
   const order=await ledger.read(orderId);
   if(!order||order.version!==expectedVersion||order.customerId!==customerId||
      order.delivery!=='NOT_DELIVERED'||!order.fingerprint||!order.plan)
      fail('FULFILLMENT_ORDER_NOT_APPROVED');
   // Product type comes only from the accepted, persisted order. Never accept route from caller.
   const product=await catalog.resolve(order.productId);
   if(!product||product.productId!==order.productId||!ident(product.version)||!product.approved)
     fail('FULFILLMENT_CATALOG_UNAPPROVED');
   if(product.kind==='custom'){
     if(order.execution!=='READY_FOR_BUILD_AND_QA')fail('FULFILLMENT_CUSTOM_PLAN_REQUIRED');
     const result=await customFactory.prepare({orderId,expectedVersion,customerId});
     if(result?.orderId!==orderId||result.customerDelivery!==false||
        result.status!=='READY_FOR_DELIVERY_REVIEW'||!result.evidence?.qa)
       fail('FULFILLMENT_CUSTOM_RECEIPT_INVALID');
     return {...result,fulfillmentKind:'custom',catalogVersion:product.version};
   }
   if(product.kind==='prebuilt'){
     if(order.execution!=='READY_FOR_BUILD_AND_QA'||!ident(product.templateId)||
        !ident(product.templateVersion)||!product.certificationRef)
        fail('FULFILLMENT_TEMPLATE_UNCERTIFIED');
     const result=await activation.activate({orderId,customerId,orderFingerprint:order.fingerprint,
       expectedVersion,templateId:product.templateId,templateVersion:product.templateVersion,
       certificationRef:product.certificationRef});
     if(result?.orderId!==orderId||result.customerId!==customerId||
        result.templateId!==product.templateId||result.templateVersion!==product.templateVersion||
        result.isolated!==true||result.accessible!==true||!result.evidenceRef||!ident(result.tenantId))
       fail('FULFILLMENT_ACTIVATION_UNVERIFIED');
     return {status:'READY_FOR_DELIVERY_REVIEW',customerDelivery:false,fulfillmentKind:'prebuilt',
       orderId,customerId,orderVersion:order.version,orderFingerprint:order.fingerprint,
       catalogVersion:product.version,tenantId:result.tenantId,
       templateVersion:product.templateVersion,evidence:{activation:result.evidenceRef,
       templateCertification:product.certificationRef}};
   }
   fail('FULFILLMENT_KIND_UNSUPPORTED');
 }
 return {prepare};
}

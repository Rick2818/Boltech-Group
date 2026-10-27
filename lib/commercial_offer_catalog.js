// Advisory commercial offers. Never use these figures to authorize payment.
export const OFFER_CATALOG_VERSION = '2026-10-27-draft-1';
export const OFFER_CATALOG = Object.freeze([
  Object.freeze({ id:'prebuilt', name:{es:'Agente preelaborado',en:'Prebuilt AI agent'}, pricing:{usd:69,period:'month',qualifier:'indicative'}, scope:{es:'Plantilla configurable; uso y soporte sujetos al plan.',en:'Configurable template; usage and support depend on plan.'}, paymentProductId:'prebuilt',requiresApprovedQuote:true }),
  Object.freeze({ id:'pilot', name:{es:'Piloto empresarial',en:'Business pilot'},pricing:{usd:600,period:'once',qualifier:'indicative'},scope:{es:'Un flujo y una integración simple.',en:'One workflow and one simple integration.'},paymentProductId:'custom',requiresApprovedQuote:true }),
  Object.freeze({ id:'custom',name:{es:'Agente personalizado',en:'Custom AI agent'},pricing:{usd:900,period:'implementation_from',qualifier:'indicative'},scope:{es:'Implementación a medida; operación y soporte adicionales.',en:'Custom implementation; operation and support extra.'},paymentProductId:'custom',requiresApprovedQuote:true }),
  Object.freeze({ id:'complex',name:{es:'Proyecto complejo',en:'Complex project'},pricing:{usd:null,period:'quote',qualifier:'quote_required'},scope:{es:'Múltiples integraciones y requerimientos especiales.',en:'Multiple integrations and special requirements.'},paymentProductId:'custom',requiresApprovedQuote:true })
]);
const FIELDS = Object.freeze(['specialty','objective','tasks','frequency','channels','users','dataSources','integrations','language']);
export function publicOffers(language='es'){
 const lang=language==='en'?'en':'es';
 return {version:OFFER_CATALOG_VERSION,status:'indicative_not_checkout',currency:'USD',items:OFFER_CATALOG.map(p=>({id:p.id,title:p.name[lang],scope:p.scope[lang],price:p.pricing,requiresApprovedQuote:true})),notice:lang==='en'?'Indicative prices only. Final scope, usage limits, taxes and approved quotation required.':'Precios orientativos. Se requiere definir alcance, cuotas, impuestos y aprobar una cotización.'};
}
export function buildFactoryIntake(input={}){
 if(!input || typeof input!=='object'||Array.isArray(input)) throw new TypeError('Invalid intake');
 const clean={};
 for(const field of FIELDS){const val=input[field];if(val===undefined||val===null)continue;if(typeof val!=='string') throw new TypeError('Invalid '+field);clean[field]=val.trim().slice(0,500);}
 return {schemaVersion:1,status:'DRAFT_NOT_ORDER',answers:clean,missing:FIELDS.filter(f=>!clean[f]),needsHumanQuote:true,canCharge:false,canProvision:false};
}

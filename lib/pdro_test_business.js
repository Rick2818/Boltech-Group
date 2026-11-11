// Invented fixtures authorized only for the fictional Pdro Imports rehearsal.
// Never use this catalog as real inventory or real commercial pricing.
export const PDRO_TEST_BUSINESS = Object.freeze({
  kind:'SYNTHETIC_BUSINESS_DATA', version:1,
  hours:'Lunes a viernes, de 8:00 a 17:00, hora de El Salvador.',
  address:null,
  shipping:'La fecha y el costo de entrega requieren confirmación de Pedro.',
  returns:'Pedro revisa cada devolución; el agente no autoriza reembolsos.',
  catalog:[
    {sku:'SYN_FILTRO_01',name:'Filtro de aire universal de prueba',aliases:['filtro de aire','filtros de aire'],priceUsd:12,stock:20},
    {sku:'SYN_ACEITE_01',name:'Aceite 10W-30 de prueba, un litro',aliases:['aceite','10w-30'],priceUsd:8,stock:15},
    {sku:'SYN_BATERIA_01',name:'Batería de prueba de 12 V',aliases:['bateria','baterias'],priceUsd:75,stock:0}
  ]
});

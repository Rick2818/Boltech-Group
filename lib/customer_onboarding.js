// Client supplied information is a reviewable draft, never a payment or activation.
export function validateCustomerOnboarding(input) {
  const errors=[];
  const text=(value,label,max=2000,required=false)=>{
    if(typeof value!=='string'){if(value!=null||required)errors.push(label+': escribe un texto válido.');return '';}
    const clean=value.trim();if(required&&!clean)errors.push(label+': obligatorio.');
    if(clean.length>max)errors.push(label+': máximo '+max+' caracteres.');return clean;
  };
  if(!input||typeof input!=='object'||Array.isArray(input))return {valid:false,errors:['La ficha debe ser un objeto.']};
  const company=text(input.company,'Empresa',160,true),contact=text(input.contact,'Responsable',160,true);
  const email=text(input.email,'Correo',254),phone=text(input.phone,'WhatsApp',30);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))errors.push('Correo: formato inválido.');
  if(phone&&!/^\+?[0-9 ()-]{7,30}$/.test(phone))errors.push('WhatsApp: incluye un número válido con código de país.');
  const description=text(input.description,'Descripción del negocio',3000,true);
  const hours=text(input.hours,'Horario',1500),address=text(input.address,'Ubicación',1500);
  const shipping=text(input.shipping,'Entregas',3000),returns=text(input.returns,'Devoluciones',3000);
  const handoff=text(input.handoff,'Atención humana',2000,true);
  const catalog=[],faqs=[];
  if(!Array.isArray(input.catalog)||input.catalog.length>100)errors.push('Catálogo: máximo 100 productos o servicios.');
  else for(const [index,p]of input.catalog.entries()){
    if(!p||typeof p!=='object'){errors.push('Producto inválido.');continue;}
    const name=text(p.name,'Producto '+(index+1),180,true),sku=text(p.sku,'Referencia',80);
    const description=text(p.description,'Descripción del producto',2000);
    const empty=p.priceUsd==null||(typeof p.priceUsd==='string'&&!p.priceUsd.trim());
    const price=empty?null:Number(p.priceUsd);
    if(!empty&&(!['string','number'].includes(typeof p.priceUsd)||!Number.isFinite(price)||price<0||price>10000000))errors.push('Precio del producto '+(index+1)+': usa un importe positivo o déjalo vacío.');
    const availability=text(p.availability,'Disponibilidad',500);
    catalog.push({sku,name,description,priceUsd:price,currency:'USD',availability});
  }
  if(!Array.isArray(input.faqs)||input.faqs.length<1||input.faqs.length>100)errors.push('Preguntas frecuentes: agrega entre 1 y 100 respuestas.');
  else for(const [index,f]of input.faqs.entries()){
    if(!f||typeof f!=='object'){errors.push('Pregunta frecuente inválida.');continue;}
    faqs.push({question:text(f.question,'Pregunta '+(index+1),500,true),answer:text(f.answer,'Respuesta '+(index+1),3000,true)});
  }
  if(input.confirmed!==true)errors.push('Confirma que revisaste la información.');
  return {valid:errors.length===0,errors,...(errors.length?{}:{configuration:{schemaVersion:1,kind:'CUSTOMER_CONFIGURATION',status:'CLIENT_SUBMITTED_FOR_REVIEW',company,contact,email,phone,description,hours,address,shipping,returns,handoff,catalog,faqs,clientConfirmed:true,agentActivated:false,paymentVerified:false,unknownFactsPolicy:'ASK_OR_HANDOFF',submittedAt:new Date().toISOString()}})};
}

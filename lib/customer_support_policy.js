// Shared by the executable sandbox and its customer preview. No network/model calls.
export function supportReply(text, conversation = {}) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const result = (reply, intent, extra = {}) => ({reply, intent, mode:'SAFE_TRIAGE_RULES', ...extra});
  if (/\b(no me escrib|no quiero mensajes|baja|stop|cancelar mensajes)\b/.test(normalized))
    return result('Entendido. No iniciaremos mensajes de seguimiento. Si necesitas ayuda, puedes volver a escribirnos.', 'OPT_OUT', {optOut:true});
  if (/\b(ignora|ignore|revela|reveal|token|contrasena|password|system prompt|instrucciones internas)\b/.test(normalized))
    return result('Puedo ayudarte con consultas de Pdro Imports, pero no compartir accesos ni instrucciones internas. ¿Qué gestión necesitas?', 'UNSAFE_REQUEST');
  if (/\b(humano|persona|pedro|asesor|queja|reclamo|reembolso|devolucion|cobro|urgente|danado)\b/.test(normalized))
    return result('Voy a dejar tu caso para revisión de Pedro. Cuéntame qué ocurrió y, si tienes uno, el número de pedido. Todavía no puedo confirmar una devolución ni un reembolso.', 'HUMAN_HANDOFF', {handoff:true, priority:'HIGH'});
  if (conversation.handoff)
    return result('Tu caso sigue pendiente de revisión humana. Agregaré este mensaje al mismo caso para Pedro.', 'HUMAN_PENDING', {handoff:true});
  if (/\b(pedido|envio|entrega|tracking|rastreo|guia|paquete)\b/.test(normalized))
    return result('¿Cuál es tu número de pedido? Lo dejaré para revisión de Pedro: todavía no tengo acceso a un sistema de seguimiento para confirmar fechas ni ubicación.', 'ORDER_STATUS', {handoff:true, priority:'NORMAL'});
  if (/\b(precio|cuesta|cotiza|cotizacion|comprar|producto|catalogo|stock|inventario|unidades|unidades|repuesto)\b/.test(normalized))
    return result('¿Qué producto necesitas y cuántas unidades? Pdro Imports debe confirmar precio y disponibilidad; todavía no tengo un catálogo aprobado para cotizar.', 'PRODUCT_INQUIRY', {collect:['product','quantity']});
  if (/\b(horario|direccion|ubicacion|abren|cierran|telefono|contacto)\b/.test(normalized))
    return result('Todavía no tengo el horario ni la dirección confirmados de Pdro Imports. Registraré la consulta para que Pedro te dé el dato correcto.', 'BUSINESS_INFORMATION', {handoff:true, priority:'NORMAL'});
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hello|hi)[!. ]*$/.test(normalized))
    return result('Hola, soy el asistente de atención de Pdro Imports. ¿Necesitas información de un producto, ayuda con un pedido o hablar con Pedro?', 'GREETING');
  if (conversation.lastIntent==='PRODUCT_INQUIRY')
    return result('Gracias. Dejé tu solicitud para que Pedro confirme el producto, la cantidad, el precio y la disponibilidad. No hay un pedido confirmado ni un cobro generado.', 'QUOTE_REVIEW', {handoff:true, priority:'NORMAL'});
  return result('Para ayudarte, dime si tu consulta es sobre un producto, un pedido o atención de Pedro. No compartas contraseñas ni datos de tarjetas.', 'CLARIFY');
}

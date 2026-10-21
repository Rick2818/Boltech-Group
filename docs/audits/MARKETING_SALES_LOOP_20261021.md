# Mercadeo vinculado a Ventas — 21 octubre 2026

## Resultado y diseño antes de implementar

Encargo de Ricardo: continuar corrigiendo Mercadeo después de constatar publicaciones y un brief genérico sin circuito comercial demostrable. Criterio: una solicitud de Agente 1 produce material vinculado a la oportunidad; Ventas lo acepta y el uso solo se acredita con correo real posterior a su preparación; una respuesta real se registra separadamente de propuesta, aceptación o pago.

Flujo mínimo: respuesta del comprador → Agente 1 solicita apoyo → Mercadeo prepara material → Agente 1 valida → transporte Gmail existente → recibo y resultado en agent_work. Sin interesados, preparar seguimiento autorizado y mensaje de prospección por flujo publicado. Contenido público apoya ese mismo segmento y dirige al diagnóstico escrito. Dos agentes, sin nuevos emisores, calendarios, modelos de pago ni tablas. Reutilizar marketing_sales_support, marketing_trace, marketing_sales_cycle_v2, inbox y cola canónica. Presupuesto USD0; Wompi fuera del alcance.

Prioridad: compradores con preguntas de precio/alcance; respuestas con interés; seguimientos autorizados; nuevos contactos verificados; contenido. Vertical operativa inicial: fabricación/metalmecánica estadounidense con cotización o consulta publicada, porque la cola real contiene esos casos. La presencia de un formulario no acredita dolor ni intención. Oferta: piloto aprobado USD990, 50/50, una empresa/un flujo web/una integración sencilla; plazo de referencia 14 días solo después de aceptación, anticipo confirmado y accesos.

Controles: no atribuir correos anteriores a materiales nuevos; baja/rechazo cancela; material no habilita envío; reservas y conciliación existentes siguen mandando. Aceptación de material por reglas de Ventas no equivale a aprobación humana ni aceptación del cliente. El circuito guarda fuente, bloqueo, responsable, versión, próxima acción y evidencia. Resultados sin proveedor o evidencia explícita quedan no verificados.

Pruebas: idempotencia, actualización concurrente sin perder uso, reserva previa, texto distinto/antiguo/remitente incorrecto sin atribución, respuesta automática o hilo ajeno sin resultado, ninguna ampliación de cadencia, CRM caído detiene aceptación. Desplegar por PR con CI y verificar filas reales; no enviar datos sintéticos ni repetir contactos para generar uso. Rollback: revertir PR; conservar evidencias y reservas.

## Causa comprobada y corrección

El ejecutor activo marketing_sales_cycle_v2 solo reescribía el brief genérico; nunca creaba materiales por oportunidad. Los módulos marketing_sales_support/marketing_trace estaban conectados al coordinador histórico y sus registros Airtable/RSI; el inbox Supabase no los invocaba. El workflow de Mercadeo declaraba frecuencia horaria, pero las ejecuciones observadas del 21 octubre fueron 04:59, 10:17 y 15:23 UTC. Su éxito acreditaba guardar el brief, no apoyo a ventas. Además, updated_at no se actualizaba en el upsert y no servía para fechar la última ejecución.

Se conectan esos módulos al CRM actual mediante un adaptador en el ejecutor de Mercadeo existente. Cada material tiene oportunidad, bloqueo, versión, responsable, idioma y evidencia; cada pregunta nueva del comprador conserva un recibo distinto. La preparación es idempotente y se salta lo ya guardado para retomar pendientes sin lote fijo. Inbox prioriza respuestas, prepara seguimientos sin anticipar el envío y registra uso real con Gmail. El resumen estratégico incorpora materiales, contactos con recibo y respuestas útiles; diagnóstico, propuesta y pago sin fuente verificada permanecen desconocidos.

La operación normal comparte el ciclo de inbox de diez minutos. El workflow anterior queda manual para recuperación; no se añade cron. No se atribuirán los correos enviados antes de este despliegue a materiales creados después.

## Verificación previa al despliegue

59 pruebas relacionadas de recorrido y atribución aprobadas, más regresiones de los consumidores históricos; sintaxis de 217 módulos aprobada. Cobertura: concurrencia, preservación de uso, texto anterior/ajeno, idioma, destinatario, MIME, pausa por CRM, recuperación sin reenvío y primer seguimiento a tres días calendario. Son pruebas con proveedores simulados. La generación real de materiales y el disparador del ejecutor se comprobarán por recibos en producción antes de anunciar activación.

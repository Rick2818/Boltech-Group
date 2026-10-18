# Tracción comercial: seguimiento y calificación — 18 octubre 2026

Responsable: Codex, por instrucción de Ricardo. Alcance: reparar el recorrido existente, sin crear agentes ni calendarios adicionales.

## Hallazgos comprobados

- Los cinco prospectos n8n siguen registrados en Leads. Interés actual UNKNOWN: no se encontraron respuestas entrantes de sus direcciones en Gmail.
- Cuatro borradores de seguimiento se guardaron en sus hilos originales y se releyeron en Gmail. No se enviaron.
- ZVEPOW ya recibió seguimiento el 16 de octubre: mensaje `1a147436170d31a8`. Se excluye de esta preparación para evitar repetición.
- El plan de seguimiento solo incluía un contacto antiguo con autorización vencida. Se incorporan los cuatro contactos como preparación, `sendAuthorized:false`; una respuesta humana puede seguir pasando a RSI-02.
- El despachador rechazaba cohortes N8N_FREELANCE y el sincronizador no actualizaba CONTACTED_AWAITING_REPLY.
- El informe de Dirección podía indicar VERIFIED con bloqueos; también olvidaba bloqueos ausentes después del siguiente ciclo.

## Correcciones

Se admiten las cohortes n8n en el despachador existente manteniendo verificación de contacto, historial, reserva Redis y conciliación. Se sincronizan los recibos de tareas n8n sin cambiar responsables ni etapas avanzadas. Preparación sin autorización de envío no dispara correos. Se reconocen rechazos explícitos en español e inglés; el agente 2 solicita requisitos por escrito y no ofrece llamadas.

Dirección diferencia fallo técnico, ATTENTION_REQUIRED y verificación técnica limitada. Los bloqueos ausentes conservan su necesidad de prueba de resolución en ciclos posteriores. Una ejecución completa nunca certifica por sí sola un seguimiento enviado.

## Cliente Sintético: certificación acotada

31 pruebas locales aprobadas, cero fallos. Caso integrado: código real RSI-01 ejecuta un seguimiento simulado en el hilo original; se introduce respuesta interesada del caso QA; RSI-01 devuelve opportunityId y evidenceRef; código real RSI-02 consume la respuesta, genera una calificación escrita y guarda recibo. Una segunda ejecución no repite ninguno de los dos envíos. RSI-03 conserva WAITING_QUALIFIED_APPROVED_CASE; no se simula una venta ni un pago.

Pruebas adicionales: timeout posterior al envío sin reintento, caída de CRM, fallos de sincronización con recuperación, recibos históricos, bajas, respuesta automática seguida de humana, autorización pendiente, informe de Dirección con bloqueos, bloqueo que desaparece y persistencia entre ciclos.

Comando reproducible:

```bash
node --test tests/test_rsi01_followups.mjs tests/test_followup_work_sync.mjs tests/test_rsi02_inbox_executor.mjs tests/test_director_audit_status.mjs tests/test_director_tracking.mjs tests/test_director_ownership.mjs
```

Estado: **ISOLATED_SYNTHETIC_FOLLOWUP_QUALIFICATION_PASS**. Gmail, Redis y Airtable son proveedores inyectados en memoria en estas pruebas. No hay envíos externos, cobros ni oportunidades productivas QA. Esto no acredita un recorrido productivo completo, interés de compradores, autonomía comercial ni la semana supervisada del protocolo de entrega. CI vuelve a ejecutar la suite en la secuencia de validación existente.

## Siguiente acción comercial real

RSI-01 conserva la reactivación de conversaciones; RSI-02 califica respuestas humanas; DIRECTORA supervisa bloqueos. Las próximas acciones de los cinco registros se actualizaron en Airtable. Cuatro revisiones indicadas para el 19 de octubre a las 09:00 SV, con referencia a borrador e hilo; ZVEPOW para el 21 de octubre, sin repetir el seguimiento del día 16. Esas fechas en CRM no prueban que el ejecutor las haya procesado.

Para los cuatro prospectos sigue pendiente permiso de recontacto sin interés previamente confirmado: la instrucción anterior de Ricardo condicionaba el envío al interés. No convertir borradores en enviados ni ampliar ese permiso automáticamente. Si se autoriza, usar un solo emisor y releer Gmail antes y después; no enviar los borradores manualmente y el plan automático a la vez.

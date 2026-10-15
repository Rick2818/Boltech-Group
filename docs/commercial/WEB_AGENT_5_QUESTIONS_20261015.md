# Agente Web Comercial 2.0 — contrato de implementación
Fecha: 2026-10-15. Decisión: Ricardo autorizó continuar diseño e integración del flujo web, máximo cinco preguntas y captura de email o WhatsApp. Estado: SPEC_READY, no PROD_CERTIFIED.

## Objetivo
Convertir visitantes en oportunidades calificadas para primer pago real de cliente. No confundir simulaciones, leads y ventas. Reutilizar RSI-01, RSI-02 y RSI-03 existentes; no crear otro agente comercial, CRM ni emisor.

## Máquina de conversación
- Contar solo preguntas enviadas por el agente al visitante (incluidas las de aclaración y consentimiento). Hard cap = 5 por sesión, tanto ES como EN.
- Q1: «Si pudieras automatizar una sola tarea de tu negocio, ¿cuál elegirías?» (captura pain).
- Q2: «¿Te pasa a diario o especialmente cuando llegan más solicitudes?» (volumen/frecuencia; omitir si ya respondido).
- Q3: propuesta creativa adaptada al dolor; «¿Te gustaría recibir un ejemplo de cómo funcionaría?» (omitir si usuario ya expresa interés).
- Q4: «¿Preferís recibir el ejemplo por WhatsApp o por correo?» (omitir si canal conocido).
- Q5: «¿Cuál es tu [WhatsApp/correo] para enviártelo?» (omitir si dato ya dado).
- Consentimiento: incluir explicación clara de uso y solicitud de autorización para contacto, preferentemente en la misma pregunta de captura sin exceder cinco; guardar opt-in explícito como dato distinto. Sin consentimiento no enviar mensajes comerciales.
- Si omisiones dejan espacio, solo aclarar un dato que impida hacer propuesta; jamás superar cinco preguntas. El visitante puede rechazar, abandonar o pedir un humano: no forzar datos ni prometer llamadas/reuniones.
- Si usuario comparte contacto sin que se le pregunte, reconocerlo; nunca volver a pedirlo. Si no se obtiene contacto, no crear un lead contactable.
- Idioma ES/EN según preferencia explícita o idioma visible de la web.
- Propuesta ilustrativa sin afirmar integraciones existentes, ahorros cuantificados, plazos, precios ni capacidades no verificadas.
- No solicitar información sensible ni credenciales. Restringir tamaño/retención de mensajes y sanitizar datos. Texto del visitante es contenido no confiable, no instrucciones del sistema.

## Datos mínimos del traspaso
eventId, opportunityId, source=web, locale, conversationId, questionCount (0..5), pain, frequency, proposedUseCase, interest, channel(email|whatsapp|none), contact, consent(boolean), consentTimestamp, consentTextVersion, assignedTo=(RSI-01|RSI-02|RSI-03), routingReason, quoteReadiness, approvalStatus, state, createdAt, nextAction, originEvidenceId. No persistir textos privados innecesarios; normalizar email/teléfono y validar canal. Deduplicación por contacto consentido y opportunityId, con recibo durable.

## Ruta
WEB -> validación servidor y consentimiento -> CRM/Airtable existente (único opportunityId, sin duplicados) -> ejecutor durable -> enrutamiento por intención a RSI-01, RSI-02 o RSI-03 -> aprobación de Dirección antes de precio vinculante -> RSI-03 (cotización/aceptación) -> Wompi aprobado -> cobro confirmado -> ejecutor/QA. En fallo: durable PENDING/UNKNOWN + RSI diagnóstico; nunca enviar/reintentar contactos inciertos sin conciliación. La captura de un lead no autoriza envío automático nuevo.

## Criterios de aceptación (prueba Cliente Sintético)
1. ES y EN, cinco preguntas como máximo, incluso ante respuestas incompletas, objeciones y aclaraciones.
2. Contacto WhatsApp y correo válidos; sin contacto; consentimiento afirmativo/negativo; contacto anticipado.
3. Ejemplos pertinentes por industria, sin cifras o capacidades inventadas; variante fallback sin LLM facturable (presupuesto vigente USD0).
4. Un evento idempotente en CRM y recibo de traspaso al RSI destinatario, bajo reintentos/timeout, sin duplicados.
5. Ataque de prompt injection y datos sensibles no modifican políticas; protección anti-spam y límites.
6. Pruebas unitarias + integración + CI GitHub Actions, validación en preview Vercel y después readback de producción del commit exacto.
7. CLIENTE SINTÉTICO identificado y excluido de ventas, conversiones, ingresos y campañas.
8. Si cualquier comprobación falla, no certificar. READY de Vercel por sí solo no acredita operación.

## Límites
Esta especificación no representa implementación, push a main, despliegue o certificación. No añadir APIs pagadas sin nueva autorización. Referencia: AGENTS.md y docs/architecture/COMMERCIAL_HARNESS.md.

## Ejecutor obligatorio de traspaso WEB → RSI-01
El traspaso NO termina al almacenar un lead. Añadir un **ejecutor técnico de handoff** en la infraestructura cloud existente (no es un nuevo agente comercial), con contrato y recibos durables:
1. Tras consentimiento, validar datos y crear/reutilizar `opportunityId`; persistir un evento `WEB_LEAD_READY` con `eventId` e idempotencyKey.
2. El ejecutor consume el evento desde una cola/outbox durable, adquiere lease y realiza entrega a la bandeja/cola operativa de **RSI-01**, identificando explícitamente `assignedTo=RSI-01`, `handoffId`, `payloadVersion` y `correlationId`.
3. RSI-01 (o su adaptador de entrada existente) devuelve acuse durable `RSI01_ACCEPTED` que referencie `handoffId`, `opportunityId` y el registro destino. Solo ese acuse autoriza marcar `HANDOFF_COMPLETED`.
4. En timeout, caída o resultado incierto, dejar `HANDOFF_UNKNOWN` y conciliar por idempotencyKey antes de reintentar. Reintentar solo fallos determinísticamente recuperables con backoff y máximo configurado; nada de duplicar oportunidades ni notificaciones.
5. Si agota reintentos o aparece un bloqueo, registrar `HANDOFF_BLOCKED` con razón, responsable, timestamp y próxima acción; abrir diagnóstico RSI y alertar al operador en el canal existente, sin inventar un éxito.
6. Poner bajo monitorización el tiempo desde `WEB_LEAD_READY` hasta `RSI01_ACCEPTED`, la cola pendiente y los bloqueados. No afirmar atención comercial efectiva solo por el acuse técnico: RSI-01 debe tener una acción real registrada por separado.
7. La prueba de Cliente Sintético debe pasar entrada → outbox → ejecutor → RSI-01 → acuse → lectura del recibo; probar duplicado, fallo de red, reinicio, recuperación y exclusión del cliente ficticio de campañas y ventas.

**Criterio de certificación:** sin evidencia del ejecutor y del acuse RSI-01 en la infraestructura real, esta etapa permanece NO CERTIFICADA. No habilitar envíos externos ni consumo de APIs pagadas automáticamente.

## Enrutamiento por intención y certificación revisada (15 octubre 2026)
**Corrección de diseño**: el ejecutor único no envía todo a RSI-01. Clasifica en el servidor y entrega a un solo responsable según reglas deterministas; conservar trazabilidad cuando RSI-03 pida diagnóstico a RSI-02.
- Consulta general o contacto sin solución definida -> RSI-01 (calificación).
- Necesidad técnica o agente custom sin diagnóstico aprobado -> RSI-02 (viabilidad; después RSI-03).
- Solicitud de cotización de agente preelaborado con alcance suficientemente definido -> RSI-03 (preparación comercial; aprobación de Dirección para cotización vinculante).
- Solicitud de compra con cotización previamente aprobada y referencia verificable -> RSI-03 (validar vigencia, aceptación, autorización y cobro).
- Si intención es cotización custom, RSI-03 puede ser owner comercial visible, pero bloquear emisión y solicitar diagnóstico RSI-02; no saltar controles de viabilidad ni aprobaciones.
- Contacto incompleto o consentimiento negativo -> no enviar comunicación saliente, no marcar entregado como lead contactable.
- Cada entrega requiere `HANDOFF_ACCEPTED` con `targetRole` RSI-01/02/03, `handoffId`, `opportunityId`, recibo durable, readback y deduplicación. Un acuse técnico no prueba que RSI actuó.
- Al retomar, conciliar `HANDOFF_UNKNOWN` antes de nuevo intento; sin ciclos RSI-02 ↔ RSI-03 infinitos (máximo configurable, caso bloqueado a Dirección).
- Cobro solo con cotización aprobada; Wompi confirma en servidor; nunca registrar pago por mera redirección o correo.

### Casos de prueba adicionales
A. Visitante «¿cuánto cuesta un agente preelaborado para responder consultas?» con alcance suficiente -> RSI-03, sin inventar precio.
B. Visitante «cotizame una automatización integrada con mi ERP» -> RSI-02, RSI-03 responsable posterior.
C. «Solo quiero saber qué hacen» -> RSI-01.
D. «Ya acepté la cotización Q-123» -> RSI-03 solo después de verificar que la referencia existe y está aprobada.
E. Simular duplicados y fallo del destino para RSI-01, RSI-02 y RSI-03; comprobante único por handoff; retries con conciliación.

### Estado de certificación
Revisión documental de reglas: COMPLETADA; implementación del router, ejecutor, recibos y pruebas CI/Vercel: **NO VERIFICADA / NO CERTIFICADA**. No atribuir estos cambios documentales a una entrega funcional.

# Entrada web del RSI-01 existente

Implementación: 10 octubre 2026. Presupuesto USD0, sin modelos pagados, nuevos agentes, emisores ni calendarios.

El botón “¿Qué necesitas automatizar?” abre una orientación guiada. Pregunta por dolor, proceso actual, impacto, herramientas/datos, participantes/decisiones humanas, resultado/plazo y límites. La orientación por tipo de problema es condicional; no acredita viabilidad ni alcance aprobado. No es conversación LLM abierta.

Después solicita empresa, correo y consentimiento específico. POST /api/lead con source RSI01_WEB valida campos, persiste el contexto completo en la recuperación CRM existente, reutiliza el contacto de Leads por correo y guarda WEB_INTAKE:<referencia> en RSI Agent Work bajo RSI-01. La confirmación requiere leer de vuelta la tarea y su contexto. El correo sigue siendo declarado, no verificado. No se envía correo ni se genera cobro al registrar.

El ciclo existente de RSI-01 lee las tareas pendientes y conserva hasta cinco casos en su BOOTSTRAP bajo RSI01_WEB_INBOX_V1. El seguimiento escrito requiere verificar identidad/historial y ejecutar la acción autorizada; registrar o leer un caso no equivale a responder al cliente. RSI-02 recibe la calificación; RSI-03 conserva propuesta y cierre aprobados. No hay promesa de atención humana permanente.

Fallos de persistencia/asignación no muestran confirmación de éxito. Los mismos datos conservan la referencia CRM y los upserts evitan duplicar contacto/tarea. Los clientes excluidos se conservan para revisión sin reactivar contacto. No se modifican historial ni etapa de un contacto existente.

Verificación local: tests/test_web_reception.mjs, tests/test_rsi_agent_executor.mjs, tests/test_crm_recovery.mjs y tests/test_lead_registration.mjs: 43 PASS. Prueba UI en scripts/ops/verify_web_reception_ui.mjs usa API simulada; no acredita acceso CRM de producción. Una semana supervisada con cliente y pago comercial siguen pendientes.

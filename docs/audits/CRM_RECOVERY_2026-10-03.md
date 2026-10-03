# Recuperación CRM y ejecutores RSI — 3 octubre 2026

Auditor e implementador: ChatGPT / Codex. Solicitante: Ricardo Ernesto Bolaños Hernández.
Alcance: recuperación de contactos HubSpot, veracidad de estados y separación de ejecutores RSI. La fecha/hora final y evidencia productiva se añaden tras la verificación.

## Qué ejecutores faltan

| RSI | Trabajo ejecutable pendiente | Estado |
|---|---|---|
| RSI-01 | Consumir oportunidad, validar cuenta/decisor e historial Apollo/CRM, reservar oferta y registrar resultado/transferencia | Coordinador y ledger disponibles; ejecutor completo pendiente |
| RSI-02 | Consumir auditoría aceptada, ejecutar comprobaciones acordadas, producir informe/propuesta y transferir alcance | Metodología y ledger disponibles; ejecutor completo pendiente |
| RSI-03 | Consumir referido/costos/propuesta, verificar consentimiento y evidencia de proveedor, registrar entrega/cobro y aprendizaje | APIs parciales disponibles; ejecutor completo pendiente |

La cola CRM implementada aquí es infraestructura compartida, no esos tres agentes ni DOTS.

## Problemas encontrados

La sincronización de leads entrantes podía reportar success=true con IDs ficticios ante fallos o falta de token HubSpot. Creaba deals sin confirmar contacto y sin idempotencia. El endpoint devolvía synced=true solo por obtener un objeto. El cron CRM comprobaba integridad pero no recuperaba escrituras. Había además una contraseña SMTP predeterminada en el motor de tríada; se retira del código actual, pero la revocación del valor histórico sigue pendiente.

## Correcciones

- Persistir contactos HubSpot en un outbox Redis antes de intentar el envío. Un almacenamiento caído no se sustituye por RAM ni informa encolado exitoso.
- Hash estable del contenido normalizado; escritura e índice de trabajo atómicos. Un mismo contacto tiene lease compartido y los contenidos antiguos quedan SUPERSEDED cuando existe otro más reciente.
- Worker con lease de 60 segundos; solicitudes proveedor con timeout de ocho segundos. Confirmación y cambio de cola verifican el token del lease mediante Lua. Recuperación por siguiente ejecución si el proceso muere.
- Buscar contacto por email antes de crear; actualizar por ID. Ante conflicto de creación recuperar el contacto. Una respuesta perdida se resuelve consultando de nuevo. No crear deals, inventar montos o rebajar lifecycle.
- 429/red/5xx: espera exponencial, Retry-After y hasta cinco intentos. Credenciales o validación: BLOCKED. IDs bloqueados visibles en diagnóstico privado; reanudación administrativa explícita.
- Endpoint CRM requiere autenticación administrativa tanto para diagnósticos como mutaciones. Errores sanitizados. Encolar usa HTTP 202 y no se presenta como sincronización completada.
- Los leads del sitio usan la cola compartida; Salesforce conserva el adaptador previo y queda fuera de esta recuperación. Airtable sigue como CRM fuente de socios/referidos; su control diario de integridad no se presenta como reparación de registros.
- Recuperación en el workflow CRM existente cada cinco minutos (horario orientativo de GitHub Actions), un contacto por ejecución. Se conserva la comprobación de integridad a las 17:00 SV de lunes a viernes. No se añade otro cron comercial ni se envían mensajes por esta recuperación.

## Contrato administrativo

GET /api/crm?action=recovery: contadores de cola, bloqueados y presencia de configuración HubSpot. Configured no significa conexión validada.
GET /api/crm?action=recovery&jobId=<hash>: estado e historial sanitizado, sin contenido del contacto.
POST /api/crm?action=recovery con {}: procesar un contacto vencido.
POST /api/crm?action=recovery con {"jobId":"<hash>"}: reanudar tarea BLOCKED tras corregir la causa.

Los registros conservan datos de contacto privados para recuperación y requieren una política de retención antes de ampliar volumen. No se incorpora una política de borrado automática en este cambio. El outbox no es multiempresa.

## Validación

17 pruebas nuevas: reinicio, duplicados, bloqueo, espera, recuperación, agotamiento, supersesión de datos, concurrencia, lease vencido, almacenamiento caído, respuesta perdida, conflicto de creación, actualización sin deals, errores proveedor, autenticación y ausencia de falsos éxitos/notificaciones. Se usa almacenamiento de prueba; la aceptación productiva se documenta después del despliegue. La falta de credenciales no puede resolverse inventando conexión.

Referencia de contrato proveedor: https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/contacts/guide

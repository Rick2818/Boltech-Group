# Leo: solicitudes voluntarias y revisión comercial

## Fuente de verdad

`public.crm_leads`, `source=LEO_INBOUND_V1`, contiene el expediente (`leo_record`) y su versión. La función transaccional `save_leo_inquiry` serializa por expediente, exige la versión anterior, deduplica eventos y actualiza las proyecciones `crm_opportunities`, `crm_proposals`, `crm_approvals`, `crm_followups` y el historial `crm_events` dentro de la misma transacción.

Una solicitud incompleta NO se proyecta como oportunidad calificada. El borrador inicial puede estar incompleto y su precio queda pendiente. Las respuestas del cliente se conservan textualmente; no hay extracción especulativa ni llamadas adicionales a un proveedor de IA para clasificar estas respuestas.

Las tablas históricas `leads/opportunities` no se importan, modifican ni incorporan a seguimientos. Los expedientes anteriores en KV siguen disponibles para consulta por ID; al habilitar el flujo nuevo, sus rutas de escritura y ejecución quedan bloqueadas para evitar dos fuentes de verdad activas. No existe migración automática de esos expedientes.

## Configuración de activación

Primero aplicar la migración `20261127160000_leo_inbound_pipeline.sql`, desplegar y verificar el código. En **producción de Cloudflare Pages**, conservar los bindings existentes y configurar:

- `SUPABASE_URL`: `https://uxwfqhromoicrwzyylbn.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: secreto de servidor; nunca una variable del frontend ni un valor en Git.
- `COMMERCE`: binding KV existente con get/put/list/delete.
- `LEO_PLATFORM_TOKEN`: secreto de propietario existente, sin cambiar su valor.
- `LEO_PIPELINE_ENABLED`: `true`, solo después de comprobar las dependencias anteriores.

No obtener secretos de logs ni pegarlos en el chat. Una conexión de Supabase disponible en ChatGPT no proporciona automáticamente estas credenciales al runtime de Cloudflare.

`GET /api/leo-pipeline-status` muestra solo enabled/configured/ready y la versión del módulo. Estos indicadores comprueban bindings, NO una ejecución comercial completa ni la existencia de la migración. La consulta privada y la comprobación de una operación autorizada verifican la conexión efectiva.

## Uso

En `/sales-agent`, el visitante activa voluntariamente «Autorizo guardar esta conversación». Un saludo no crea expediente. Una solicitud sustantiva inicia la recopilación progresiva de proceso, herramientas, volumen, resultado y límites. Empresa, contacto, presupuesto, plazo y decisor admiten respuestas desconocidas; no se inventan datos. El formulario de propuesta también usa el mismo expediente en Supabase cuando el flujo está habilitado.

El propietario inicia sesión en «Integraciones privadas», abre «Solicitudes recibidas por Leo» y pulsa «Actualizar pendientes». Allí revisa el expediente, completa alcance/exclusiones/precio y aprueba la revisión exacta, solicita cambios o rechaza. La aprobación interna NO autoriza un envío. Un cambio de propuesta o una respuesta posterior del cliente invalida la aprobación anterior y detiene seguimientos relacionados.

Al aprobar una versión se prepara un recordatorio interno para el día siguiente. Cada seguimiento conserva el estado, la revisión y la ausencia de recibo externo. El panel muestra fecha y borrador. No hay implementación de despacho externo en esta versión: queda pendiente verificar un canal y una autorización específica por mensaje antes de habilitar ese alcance. Nunca se representa PREPARED/REVIEW_DUE como mensaje enviado.

«retirar consentimiento» / «withdraw consent» cancela el seguimiento y elimina la cookie de continuidad. No borra la evidencia ya guardada ni ejecuta cobros.

## Recuperación y ejecución persistente

Antes de guardar en Supabase se conserva un intento cifrado en el KV existente, con ID estable de conversación y mensaje. Si la base falla, la respuesta indica QUEUED; no afirma persistencia confirmada en Supabase. Los reintentos usan el mismo evento y no consumen dos respuestas. Cambios de pregunta o versión producen conflicto visible en vez de sobrescritura.

`POST /api/leo-pipeline-tick` requiere el token de servidor del propietario. Recupera hasta 20 intentos de KV por llamada, con hasta cinco intentos y espera creciente; después expone el bloqueo y la respuesta pendiente en el panel privado. Las escrituras SQL son idempotentes bajo concurrencia. KV sigue teniendo consistencia eventual; los contadores de intento son orientativos bajo concurrencia, pero SQL evita duplicar el expediente y sus transiciones.

Se amplió el ejecutor **existente** `cloudflare/leo-autonomy-cron.mjs`: cuando su entorno tiene `LEO_PIPELINE_ENABLED=true`, llama también al tick de pipeline, además del trabajo de autonomía anterior. No se crea otro programador ni se reactivan crons retirados. **Este archivo no lo publica el workflow de Pages**: hay que verificar el Worker de cron desplegado, actualizarlo preservando sus bindings y horario existentes, y comprobar un tick real antes de declarar recuperación programada activa. Su ausencia o falta de credenciales es un bloqueo de activación, no un éxito.

No se depende de una pestaña abierta: el guardado y borrador son operaciones dentro de cada solicitud del Worker; la recuperación depende del cron verificado. El tick solo cambia recordatorios internos a REVIEW_DUE y registra su ejecución en `crm_events`. El panel conserva también las fechas para revisión humana. Ningún cron puede enviar mensajes mediante este módulo.

## Validación reproducible

```sh
npm ci --prefix tests/db --ignore-scripts --no-audit --no-fund
node --test tests/test_leo_pipeline.mjs tests/test_leo_pipeline_database.mjs
python3 scripts/pages_ci.py build
node --check .cloudflare/pages-release/_worker.js
node --check .cloudflare/pages-release-check.js
```

Las pruebas de base usan PostgreSQL WASM en memoria, con fixtures aisladas. Cubren compilación SQL, permisos, deduplicación, versiones, rollback de todas las proyecciones y el recorrido HTTP real del Worker con cifrado de sesión. No insertan clientes sintéticos en producción. Ejecutar además la batería de regresión de Pages del workflow.

El despliegue debe comprobar el hash del HTML y los endpoints reales. Si una ruta API devuelve HTML, no funciona como API aunque su estado HTTP sea 200. El flujo solo puede declararse operativo tras verificar runtime, conexión, revisión privada y cron; el envío externo sigue fuera de alcance hasta su autorización y validación específicas. Wompi y el gateway de pagos no se modifican.

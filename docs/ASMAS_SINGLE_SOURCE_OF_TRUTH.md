# ASMAS — fuente única de verdad (auditoría 2026-10-14)

## Norma de trabajo
- **GitHub rama `feature/asmas-v4-1-core` = código fuente versionado de ASMAS**; PR #62 sigue separado de `main`.
- **Supabase proyecto `pkgztteqtyebsggxnett` = estado de runtime y datos**, NO asumir que una versión desplegada coincide con el código GitHub.
- **Vercel `asmas-staging` = entorno de staging**, no evidencia de producción comercial lista.
- Work y Codex solo contribuyen a ASMAS mediante cambios entregados a la misma rama/PR; revisar diff y pruebas antes de nuevos despliegues. El trabajo local sin push no puede verificarse desde aquí.
- No fusionar a `main`, no activar envíos comerciales ni pagos, no contratar servicios; no certificar ejecuciones simuladas como reales.

## Inventario observado el 2026-10-14
- GitHub rama: `feature/asmas-v4-1-core`; módulo `asmas/gemini-runtime.mjs` apunta a `gemini-3.8-flash`.
- Supabase Edge Function `asmas-batch` **v13 ACTIVE** con `gemini-3.8-flash`, límite actual de **1 tarea sintética por lote** y timeout de 45 s. **La función instalada es más reciente que v8 discutida en el chat**; NO sobrescribir con versión antigua.
- Supabase `asmas.simple_runtime`: `google_free_tier_verified=true` en campo DB, `last_status=TASK_NEEDS_REVIEW`, última marca 2026-10-14T02:01:57Z. El booleano NO prueba acceso del proveedor.
- Registro `asmas.tasks`: `SYN-E2E-001`, agente A5, `NEEDS_REVIEW`, 3 intentos. No consta prueba de cinco agentes completada.
- Registros Edge: POST 502 a 2026-10-14T02:01:57Z; POST 200 a 01:41:53Z no certifica por sí solo inferencia ni venta.
- Vercel `asmas-staging`: despliegue READY `f98805d24ca7885ca3d81d3498c65ce603b2cb4f`. Comparar con punta actual antes de hablar de sincronización.

## Brecha y criterios para cerrar
1. Identificar la razón exacta del último POST 502 / resultado de la tarea A5 en v13, sin manipular claves.
2. Confirmar que Google AI Studio habilita `gemini-3.8-flash` en **Free Tier** en el proyecto de la API key. El catálogo general sí muestra Free Tier; el acceso particular NO está demostrado.
3. Conciliar el código desplegado v13 con la rama GitHub (cambios y pruebas); nunca bajar inadvertidamente a v8.
4. Ejecutar y registrar una prueba real e independiente de A5, A1, A2, A3, A4 con `SYN-E2E-001`, salida y evidencia por agente; sin correo real ni cobro.
5. Validar GitHub Actions y despliegue de staging sobre el SHA confirmado. Solo declarar 'listo' tras el E2E completo y aprobado.

## Estado
**NO CERTIFICADO / TEST SINTÉTICO BLOQUEADO**. Este documento reemplaza descripciones antiguas de 'última versión'; debe actualizarse cuando cambie el runtime.

## Diagnóstico confirmado — 2026-10-14 (fase 1)
- Supabase `net._http_response` conserva detalles del ejecutor, no basta con revisar `function_logs`.
- Solicitudes 11–15: `MODEL_TIMEOUT` (11,13), `GEMINI_PROVIDER_HTTP_503` (12,15), `INVALID_MODEL_RESULT` (14). La solicitud 10 devolvió `IDLE`, **cero tareas procesadas**: no equivale a inferencia aprobada.
- Tarea A5 `SYN-E2E-001`: `NEEDS_REVIEW`, 3 intentos y `result=NULL`. No existe evidencia de éxito de A5 ni de los cinco agentes.
- `asmas.simple_finish` valida estrictamente `gemini-3.8-flash`, agente, texto y `provider_verified`; evitar relajar esta validación o crear salidas simuladas. La causa particular de `INVALID_MODEL_RESULT` no está suficientemente determinada.
- Modelo `gemini-3.8-flash` **sí tiene estándar Free Tier** según https://ai.google.dev/gemini-api/docs/pricing (sujeto al proyecto/clave y cuota). HTTP 503 indica indisponibilidad temporal del proveedor, no falta de permiso comprobada.
- Siguiente corrección: registrar motivo exacto de fallo de validación, usar política de reintento acotada para 503/timeouts e iniciar nuevamente solamente el caso sintético con seguimiento verificable. Mantener `main`, correos y cobros intactos.

## Despliegue confirmado — 2026-10-14
- Edge Function `asmas-batch` **v14 ACTIVE** en proyecto independiente ASMAS; conserva la lógica de v13 e incorpora la corrección GitHub `5d11c3043d47db0d073ac9dbde098ac125631685` (segundo intento únicamente tras HTTP 503).
- GitHub Actions previas para ese commit: checks completados con éxito.
- **No certificación de inferencia todavía**: A5 `NEEDS_REVIEW`, 3 intentos; `last_status=TASK_NEEDS_REVIEW`, último registro de ejecución previo a v14. No confundir el despliegue con una prueba exitosa.
- Evitar reactivar automáticamente la tarea A5 agotada sin confirmar la causa `INVALID_MODEL_RESULT`/semántica de lease; ejecutar nuevo caso sintético controlado antes de certificar.

## Prueba aislada de proveedor — 2026-10-14
- Se desplegó una función diagnóstica separada `asmas-model-probe` v1 en el mismo proyecto Supabase ASMAS. Requiere token de trabajador ASMAS y no expone la clave ni habilita acciones comerciales.
- Solicitud de diagnóstico `net._http_response.id=17`: HTTP 200 en consulta de metadatos (`models/gemini-3.8-flash`), soporte `generateContent=true`; generación mínima (`Reply only OK`) HTTP **503**, sin respuesta.
- La clave está presente/aceptada para consultar el modelo, pero la inferencia no está disponible en esa prueba. El proveedor puede tener indisponibilidad/cuota; **no afirmar causa exacta del 503** sin cuerpo de error o métricas de cuota.
- Circuito de base de datos sin IA: transacción de prueba revertida generó exactamente una tarea A1, un mensaje de traspaso y un evento outbox. Después del ROLLBACK, cero artefactos ficticios.
- Consecuencia: congelar los reintentos ciegos de A5; revisar error estructurado de Gemini, capacidad y cuota, o introducir proveedor alternativo **solo después de confirmar plan gratuito**. Sin mails, cobros ni cambios a main.

## A5 → A1 probado con inferencia real — 2026-10-14
- Supabase `asmas-batch` v18 ACTIVE; A5 usa `gemini-3.5-flash-lite` para esta prueba y otros agentes mantienen `gemini-3.8-flash`.
- Corrección decisiva del ejecutor: en `source/index.ts`, pasar `database().json(result)` a PostgreSQL en vez de `JSON.stringify(result)` para que la validación JSONB acepte el resultado real. SQL `asmas.simple_finish` permite Flash-Lite solo para A5.
- `SYN-E2E-001`, run `c04f5584-03e5-4b8f-a5b7-6094d758de13`, solicitud HTTP interna 23, HTTP 200 y `BATCH_COMPLETED`, una tarea procesada.
- Datos observados: A5 `SUCCEEDED`, modelo `gemini-3.5-flash-lite`; **exactamente 1 tarea A1 `QUEUED`, 1 mensaje A5→A1 y 1 evento de cola**. A1 aún NO ejecutado ni certificado.
- Este es el primer traspaso A5→A1 comprobado con IA real. No equivaler a certificación de 5 agentes. Sin correos/cobros reales.
- **Pendiente crucial:** conciliar los cambios de Supabase v18 con el código de la rama GitHub antes de un próximo redespliegue, para evitar reversión involuntaria.

## A4 director persistent integration — 2026-10-14
- Supabase `asmas.director_decisions` table and `asmas.director_assign(uuid,text)` SQL adapter created. `asmas.simple_finish` gates fixed transitions for tasks explicitly marked `director_mode=true`; the legacy unmarked synthetic workflow stays operational.
- Live synthetic run `94730cff-263c-4f77-81bc-0b1ca345a118`: A5, A1, A2, A3, A4 each `SUCCEEDED` on first attempt with `gemini-3.5-flash-lite`. Synthetic run status `COMPLETED`, 5 agents completed; 0 emails, 0 payments, no commercial certification.
- A4-to-A1, A2, A3 SQL adapter orders returned `ASSIGNED`; durable `director_decisions` holds three records. Repeating A2 returned `ALREADY_ASSIGNED`. A4 review/final stage completed.
- LIMITATION: A4 assignment calls in this test were invoked explicitly, NOT autonomously by the A4 model. A4 orchestration remains operator-triggered; a protected autonomous coordinator, deeper supervision/RSI and full live commercial validation are still required.
- Follow-up needed: place Supabase SQL changes under repository migrations (source-control parity), add integration tests to the CI suite, audit concurrency/idempotency transaction boundaries; do not alter Boltech `main`.

## A4 RSI supervision update — 2026-10-14
- `asmas.director_rsi_audit()` and `asmas.director_incidents` created in Supabase. Flags `NEEDS_REVIEW` and expired `LEASED` tasks for `SYN-E2E-001` with `director_mode=true`; idempotent unique `(task_id,reason)`, RLS enabled, no anon/authenticated access.
- `asmas-director-rsi-5m` cron active every 5 minutes; `asmas-director-5m` and `asmas-batch-15m` also active.
- SQL transaction-only fault injection verified one incident in transaction; rolled back test fixture. Persistent incidents=0; automatic retries authorized=0.
- Limitation: does NOT auto-retry failed tasks or implement autonomous repair decisions. Stage 1 autonomous A4 cron configured, but still no observed pg_cron run history; current isolated run `fdbbf236-678b-433a-ab7f-a6c17d6ef9fa` has A5,A1,A2 `SUCCEEDED`, A3/A4 pending at last inspection.
- Changes to Supabase RSI/cron are not yet versioned as executable migrations. Do not assert full autonomy or live commercial readiness.

## 2026-10-14: Autonomous A4 and RSI policy evidence
- Verified **actual scheduled pg_cron execution** `asmas-director-5m` at `2026-10-14 20:35:00 UTC`: `succeeded`. A3 decision for synthetic run `fdbbf236-678b-433a-ab7f-a6c17d6ef9fa` created at `20:35:00 UTC`, independently of manual calls. `asmas-director-rsi-5m` also succeeded on schedule.
- `asmas.director_rsi_classify` classifies transient (provider 429/503, timeout), hard failures (auth, schema/model mismatch), uncertain expired leases, completed outcomes and review-required cases. `asmas.director_rsi_retry_decision` gates controlled retry eligibility on evidence: no started provider call, no committed result, no external effect, complete evidence, bounded attempts. Six scenario SQL tests passed.
- Crucial distinction: **retry eligibility does not execute a retry**. No persistent `retry_authorized` flags set; no automatic retries allowed yet. Provider outcome ambiguity, uncertain leases and possible external side effects remain blocked pending reconciliation. Live synthetic run has A5/A1/A2 `SUCCEEDED`, A3 `QUEUED` in last inspection; do not claim it completed.
- Pending: wire classification outputs to incident records and implement audited, atomic compare-and-swap requeue after proving provider request never started; version SQL migrations as code and verify CI. No changes to Boltech main, no commercial emailing or payments.

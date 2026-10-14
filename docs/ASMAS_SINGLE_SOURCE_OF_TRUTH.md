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

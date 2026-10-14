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

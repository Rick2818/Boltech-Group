# Inventario de consolidación de agentes — 2026-10-18

## Propósito y estado

Concentrar los cambios de los cinco roles en una sola rama de integración sin cambiar todavía el runtime de producción ni retirar los flujos existentes.

- Worktree de integración: `.worktrees/codex-upwork-n8n-supabase-20261018`.
- Rama: `codex/unified-agents-asmas-20261018`, iniciada en `f8e945ab4c6488090b97ef65de1a47604035251f`.
- `main` y `origin/main` no se modificaron.
- Los cambios ASMAS se copiaron desde `origin/migration/asmas-commercial-single-system-20261015`; sus ramas de origen siguen intactas.
- Veredicto de integración a producción: **HOLD**. Este inventario y los archivos de staging no certifican el runtime ni autorizan retirar workflows.

## Mapa propuesto de identidades

| Identidad objetivo | Rol ASMAS | Rol existente equivalente | Estado de equivalencia |
|---|---|---|---|
| Agente 1 | A1 Vendedor | RSI-01 / BLIA-01 | Conceptual; runtime e historial no migrados |
| Agente 2 | A2 Cotizaciones y seguimiento | RSI-02 | Conceptual; runtime e historial no migrados |
| Agente 3 | A3 Cierre | RSI-03 | Conceptual; runtime e historial no migrados |
| Orquestación | A4 Director | Agente 4 / Dirección | Conceptual; consumidores y recibos no migrados |
| Mercadeo | A5 Mercadeo | `marketing-director` | Conceptual; CRM, Flova y recibos no migrados |

Los nombres no prueban que los IDs, permisos, colas, estados ni historiales sean intercambiables. Mantener los consumidores existentes hasta demostrar reemplazo completo.

## Fuentes reunidas en esta rama

- `origin/main` en `014e961`: contiene el flujo comercial reciente de Agent 1, RSI-02/03 y Agent 4, además de las mejoras de marketing integradas en ese punto.
- Tres commits posteriores de `origin/codex/upwork-n8n-supabase-20261018`: `b4e6642` (fuente pública de trabajos n8n), `a18e719` (estado de Flova) y `f8e945a` (cliente MCP oficial de Upwork para Agent 1). Están en la historia de esta rama.
- Ocho archivos de `origin/migration/asmas-commercial-single-system-20261015`: definiciones A1–A5, runtime y lote ASMAS de staging, adaptador Supabase, documentos de migración, dirección, auditoría y acciones Upwork/Lusha.
- La rama ASMAS remota está conservada sin modificar; sus ocho commits únicos no se borraron ni se reescribieron.

El branch ASMAS termina el 15 de octubre y no contiene los commits del 17–18 de octubre. La versión local de `main` está atrasada respecto de `origin/main` y tiene modificaciones locales; no actualizarla ni limpiarla como parte de esta integración.

## Bloqueos de reemplazo que deben resolverse

1. `asmas/simple-batch.mjs` usa el ID sintético histórico `SYN-E2E-001`. La regla vigente exige que las pruebas reutilicen únicamente el caso `config/qa_case.json` (`QA_WEB_RECEPTION_20261010`) y que no aparezca en métricas comerciales.
2. `asmas/supabase/index.ts` llama funciones SQL `asmas.simple_authorized`, `asmas.simple_claim_one`, `asmas.provider_record_stage`, `asmas.simple_finish` y `asmas.simple_fail`. No se encontraron migraciones SQL en el branch ASMAS ni bajo `supabase/migrations` en el worktree de integración.
3. El runtime invoca Gemini y solo se puede habilitar tras verificar el nivel gratuito en el proyecto destino. Presupuesto confirmado: USD 0; no activar llamadas ni desplegar por el mero hecho de que el código exista.
4. Upwork MCP requiere autorización OAuth 2.1 persistida en el runtime que consume Agent 1; el callback Developer API no la sustituye. La documentación del branch registra autorización de cuenta, secretos de workflow y relectura desde GitHub Actions como pendientes.
5. La fuente pública de empleos n8n es de solo lectura; no acredita una credencial n8n Cloud ni un workflow autorizado.
6. La documentación de Flova exige habilitar el conector oficial y completar autorización en Codex; el estado de código no demuestra acceso del agente de mercadeo.
7. Falta prueba E2E de reemplazo para los cinco roles, persistencia/lectura de tareas, reintentos seguros, permisos, recibos y un ciclo completo sobre el único caso QA. No se certifica autonomía ni conexión productiva.
8. Hay ramas remotas paralelas del 17–18 de octubre que aún no se archivaron: `origin/feat/a4-orchestration-skills-20261018`, `origin/agent1-source-access-validation`, `origin/fix/agent1-auth-preflight-20261018` y las ramas de preparación/verificación de cinco leads, además de correcciones RSI/Director/Mercadeo. Algunas duplican funciones que ya llegaron a `origin/main`; otras agregan roles E1–E4 o QA multiproveedor. Se deben reconciliar archivo por archivo antes de decidir que están reemplazadas. No se importaron ni archivaron a ciegas.

## Regla de archivado

No archivar worktrees, ramas, agentes ni workflows RSI/BLIA/Marketing existentes hasta que un mismo commit en `main` incluya la implementación elegida y sus pruebas de reemplazo pasen. Antes de archivar, comprobar el historial remoto, los worktrees administrados y cualquier cambio sin commit; conservar una referencia recuperable de cada origen. El archivado de código no borra el historial del CRM ni migra credenciales o datos.

## Verificación hecha en esta consolidación

- `node --check` pasó para los tres módulos ASMAS copiados y los módulos principales recientes de Agent 1 (descubrimiento n8n, integración y autorización Upwork).
- 39 pruebas seleccionadas de Agent 1, Upwork MCP/OAuth, Director, Mercadeo, RSI-02 y sincronización pasaron tras adaptar `tests/test_rsi02_inbox_executor.mjs` para usar solo `config/qa_case.json` y comprobar que no hay mutaciones para QA.
- No se ejecutó una prueba de runtime ASMAS porque el branch no incluye esquema/migraciones y su ID QA histórico no cumple la regla vigente.
- No se ejecutaron mensajes, postulaciones, envíos, cobros, despliegues ni escrituras a CRM/Supabase.

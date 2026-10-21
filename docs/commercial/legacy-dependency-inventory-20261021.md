# Auditoría de dependencias comerciales — 21 de octubre de 2026

**Decisión:** Supabase es la fuente de verdad comercial. Gmail empresarial es el canal remitente. Mantener intactos pagos, Wompi y conciliación.

## A. Producción vigente (mantener)

| Ruta | Función y dependencia |
| --- | --- |
| `lib/agent1_continuous_cycle.js` | Prospección, evidencia y borradores en Supabase, ejecutado por `boltech-research` |
| `lib/agent1_company_draft_review.js` | Verificación Gmail e historial, elegibilidad/supresiones Supabase; **no autoriza envío** |
| `lib/agent1_autonomous_inbox.js` | Procesamiento de respuestas Gmail con recibos Supabase |
| `lib/marketing_sales_cycle_v2.js` | Materiales y transferencia a ventas mediante Supabase |
| `lib/explee_hot_leads_sync.js` | Fuente Explee a Supabase |
| `lib/sdr_gmail.js` | Adaptador Gmail compartido; **no borrar por contener SDR en su nombre** |
| `lib/canonical_followups.js` / `lib/canonical_followup_sender.js` | Seguimiento existente por Gmail y Supabase, 3 días calendario |
| `lib/rsi_handoff_store.js` | Redis y primitivas de handoff compartidas; **no retirar sin migrar** |
| `lib/payment_store.js`, `lib/payment_providers.js` y Wompi | Pagos; completamente excluidos de cualquier desactivación |

## B. Dependencias antiguas aún enlazadas: NO eliminar sus rutas físicas sin sustitución

| Dependencia | Origen confirmado | Clasificación | Sustitución/acción necesaria |
| --- | --- | --- | --- |
| `lib/sdr_dispatch.js`, `lib/sdr_campaign.js` | `api/partners.js` (importación directa y acciones `sdr-send`, `sdr-campaign`) | **Ruta HTTP antigua potencialmente invocable, Airtable** | Bloquear o retirar rutas de envío antiguas antes de eliminar importaciones; desarrollar ejecutor idempotente Supabase y pruebas de recibos |
| `lib/rsi01_*` | `api/partners.js` importa preparación, campaña, investigación y plataforma con `import()` | **Legado todavía accesible** | Retirar `rsi01-prepare`, `rsi01-daily`, `commercial-activation` después de comprobar consumidores |
| `lib/rsi_agent_executor.js` | `api/partners.js`, `lib/rsi_cycle_runner.js` | **Legado con dependencias cruzadas** | Separar ejecución antigua de utilidades de lectura y notificación; migrar al CRM canónico |
| `lib/rsi02_inbox_executor.js`, `lib/rsi03_closing.js` | `api/partners.js` y `lib/rsi_agent_executor.js` | **Airtable; cierre legado** | Reemplazar con ciclo actual y conciliación de pagos; prohibido modificar Wompi |
| `lib/marketing_crm_executor.js` | `api/partners.js?action=marketing-crm-intake` | **Escritura antigua a Airtable** | Redirigir ingreso comercial al mismo Supabase de Agente 1 |
| `lib/airtable_partner_store.js` | `lib/rsi_agent_executor.js` y servicios partner | **No es solo prospección** | Revisar si los datos de socios/contabilidad siguen siendo necesarios antes de retirar |
| `scripts/ops/run_rsi_agents.mjs` | `.github/workflows/director-hourly-oversight.yml` | **Workflow antiguo que invoca ejecutores RSI** | Sustituir por supervisión del motor nuevo antes de desactivar |
| `scripts/ops/partner_cron_runner.mjs` | `.github/workflows/boltech_crm_sync.yml` y `boltech_daily_report.yml` | **Airtable aún usado por trabajos programados** | Migrar integridad e informes a Supabase, luego retirar schedules antiguos |
| `scripts/ops/verify_sdr_production.mjs` | `.github/workflows/sdr_connection_verification.yml` | **Prueba de integración antigua; no salida comercial** | Conservar únicamente pruebas Gmail genéricas y migrar validación a Supabase |
| `scripts/rsi01-gmail-dispatch.cjs`, `scripts/rsi01-outreach-executor.cjs` | Respaldados en `archive/`; referencias históricas y pruebas | **No parte del cron Supabase vigente** | Retirar solo cuando pasen pruebas de regresión y se verifique ausencia de invocadores |

**Riesgo encontrado:** aunque el motor nuevo funciona sin Airtable, `api/partners.js` todavía permite invocar **acciones comerciales heredadas**. Haber archivado copias no las desactivó. Evitar declarar el sistema comercial antiguo completamente retirado hasta bloquear esas rutas y migrar los workflows.

## C. Programación actual comprobada

Supabase `cron.job`: `boltech-research`, `boltech-inbox`, `boltech-explee`, `boltech-receipts`, `boltech-marketing`, todos activos. La programación adicional en GitHub Actions requiere atención separada; **un cron Supabase activo no desactiva workflows GitHub existentes**.

## D. Procedimiento de retirada sin pérdida de datos

1. Bloquear entradas HTTP antiguas de envío, con `410 LEGACY_COMMERCIAL_RETIRED` y prueba que confirme 0 llamadas a Gmail/CRM.
2. Sustituir envíos y recibos por un ejecutor Supabase-nativo con claves idempotentes, historial Gmail, exclusiones y recibos persistidos.
3. Migrar los trabajos de CRM/informes/supervisión de GitHub Actions que todavía usan Airtable.
4. Sustituir las importaciones antiguas de `api/partners.js` y `lib/rsi_agent_executor.js`. Mantener las primitivas compartidas y pagos.
5. Solo entonces mover o eliminar las rutas físicas heredadas de `lib/`, `api/` y `scripts/` con verificación de imports, contratos, gobernanza y producción.

## E. Control reproducible

`node scripts/quality/audit_legacy_commercial_dependencies.mjs --json` recorre el árbol activo y entrega importaciones heredadas, referencias Airtable, rutas API y workflows programados. La prueba de calidad impide reintroducir módulos comerciales antiguos en el motor continuo Supabase.

**Alcance:** inventario técnico de código y cron, no certificación de que todos los componentes históricos estén ya eliminados. Esa eliminación requiere las migraciones anteriores.

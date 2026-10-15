# ASMAS como arquitectura comercial única — fase de migración (2026-10-15)

## Decisión y alcance
Una sola arquitectura comercial: ASMAS V4.1 con A5 Mercadeo, A1 Prospección, A2 Cotizaciones, A3 Cierre y A4 Director. Migración progresiva sin mensajes ni cargos reales; gasto adicional USD 0. Preservar Wompi, CRM histórico, registros financieros, seguridad y auditorías.

## Inventario comprobado
- Main antes del cambio: `fcc4bb54a10a139ac1af189b73f2eb43efa66b64`; incorpora ocho commits nuevos de RSI-01, investigación pública y campaña condicionada a aprobación.
- Cron heredados BLIA, MIT, RSI acceptance y daily planner: retirados en PR #63.
- **Hay un nuevo cron** `.github/workflows/asmas_rsi01_9am.yml` que ejecuta `scripts/ops/run_rsi_agents.mjs` y `POST /api/partners?action=sdr-campaign`. Es parte del flujo híbrido anterior y no es todavía ASMAS V4.1 integrado; no declararlo sustituido.
- Cuatro APIs antiguas: `api/lead.js`, `api/a2a.js`, `api/partners.js`, `api/intel.js` tienen dependencias en otros módulos. PR #64 permanece sin fusionar; aunque algunas pruebas han aprobado, no sustituye su comportamiento con ASMAS y puede eliminar el nuevo RSI-01.
- Módulos aprovechables ya presentes en main: `lib/rsi01_public_research.js`, `lib/rsi01_research_executor.js` y `lib/asmas_research_watchdog.js`. Investigan y clasifican prospectos; NO autorizan envío.

## Código migrado en esta rama
- `asmas/simple-batch.mjs`
- `asmas/supabase/index.ts`
- `asmas/gemini-runtime.mjs`
- `asmas/agent-definitions.mjs`
- `docs/architecture/DIRECCION_COMERCIAL_POR_RICARDO_BOLANOS.md`

Estos archivos son **núcleo de staging**; requieren instalación de migraciones SQL, secrets y despliegue controlado. Copiar código por sí solo NO acredita que A1..A5 estén ejecutándose dentro de la producción Boltech. Referencia de pruebas originales: proyecto aislado Supabase ASMAS, run `1dfc5ed5-b9e2-4e3b-8544-7ce82fefe71c`; no cambiar el origen de la evidencia.

## Puerta de retirada definitiva
1. Integrar investigación pública del nuevo RSI-01 como habilidad exclusiva del A1 comercial; conservar validación de fit, consentimiento y revisión comercial humana, con claves externas autorizadas.
2. Versionar/reconstruir en proyecto aislado funciones SQL, ledger de evidencia, leases, idempotencia y cuatro cron RSI/director/worker.
3. Completar E2E con cinco agentes en el *nuevo entorno de Boltech*, probar preflight failure y recuperación vía cron sin intervención, validar 0 envíos/0 cobros.
4. Solo al tener pruebas de reemplazo, retirar cron híbrido `asmas_rsi01_9am.yml`, antigua ejecución RSI, APIs y ejecutores legacy; mantener diagnósticos privados necesarios para Wompi.
5. Actualizar tests que describen funciones heredadas, ejecutar CI integral sobre el mismo commit, validar Vercel y confirmar ausencia de dobles cron o rutas activas. No borrar datos históricos.

**Estado presente:** núcleo importado; investigación RSI-01 ya existe en main; conexión funcional entre ambos, migraciones SQL en Boltech, pruebas E2E y retirada total del sistema anterior **pendientes**. Ninguna modificación a Wompi ni activación de envíos comerciales autorizada.

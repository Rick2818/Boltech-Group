# Auditoría de solo lectura — Boltech comercial — 2026-10-30 16:50 America/El_Salvador

## Alcance
Arquitectura vigente: Agente 1 Ventas y Agente de Mercadeo. RSI de mejora de Agente 1 no equivale a ejecutores heredados RSI-01/02/03. No se envió correo, no se consumieron créditos, no se cambiaron secretos, ejecutores, producción ni Wompi.

## Evidencia verificable
- PR #178 fusionado el 2026-10-20, merge commit `c675f2c9d847c10dbe863d9cf4654fa0ff285875`. Sus cinco workflows asociados a la cabeza `a3f2515a93eb47b38a6893b5a6f0dffb1768d65f` concluyeron success. Estos resultados no prueban una operación real de extremo a extremo.
- Vercel proyecto `boltech-group`: último despliegue production READY `dpl_D9r12h1yZnqQQzkV4es4Cr7n56rs`, commit `897062ee3c4c1b65bbe752c95273938b25b53a6e` (micrófono de Leo). READY no certifica la autonomía comercial.
- Vercel tiene nombres de variables production `EXPLEE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `INTERAGENT_ROLE_KEYS`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Se comprobó solo existencia de claves, no valores ni autenticación efectiva.
- Supabase proyecto Boltech Group `uxwfqhromoicrwzyylbn`: ACTIVE_HEALTHY. Tablas y registros observados mediante SELECT: `leads` 1229; `agent_work` 68; `marketing_sales_briefs` 1; `marketing_content_runs` 39; `agent1_commercial_cycle_receipts` 1117; `explee_hot_leads` 0; `explee_hot_leads_cursor` 0.
- Último recibo de ciclo comercial: 2026-10-30 22:46:04 UTC, 1229 leads revisados, 36 contactados históricos, 36 seguimientos pendientes, 0 interesados; resultado `RESEARCH_CYCLE_COMPLETED`. En las últimas 24 horas se registraron 144 ciclos con ese resultado, sin evidencia de nuevos cierres.
- Los 39 registros de Mercadeo son `SALES_HANDOFF` con `distribution_status=SALES_QUEUE_READY`, último 2026-10-30 06:02 UTC. No se comprobó recibo de consumo por Ventas. El único `marketing_sales_briefs` tiene `proof_status=UNVERIFIED` y `status=READY_FOR_SALES_REVIEW` desde el 2026-10-20.
- En `agent_work` hay 3 registros con referencias históricas `AGENT2`; son datos legados, no prueba de un agente vigente ni motivo para detener ejecutores.
- `lib/agent1_v2_five_lead_gate.js` ya no impone lotes de cinco; documentación corregida en este PR.
- Explee: existe adaptador MCP con `listTools` y requisito `search_companies`, pero no se ejecutó autenticación real ni búsqueda de consumo potencial. Sin recibo autenticado, Explee permanece **NO CERTIFICADO**.

## Bloqueos y próximos gates
1. Explee: ejecutar prueba autenticada de `listTools` sin búsqueda de pago y guardar recibo sin secretos; confirmar `search_companies` antes de marcar conectado.
2. Mercadeo → Ventas: instrumentar/observar recibo de consumo de un brief real con identificador, fecha, evidencia y resultado; `SALES_QUEUE_READY` por sí solo no es consumo.
3. Agente 1: conciliar recibos de ciclo con acciones verificables (respuestas, cotizaciones, seguimientos y cierres), sin confundir inspección repetida con actividad comercial efectiva.
4. Preservar ejecutores heredados potencialmente activos hasta disponer de reemplazo certificado y plan de reversión.

**Dictamen:** CI y persistencia básica observables; autonomía comercial de extremo a extremo, Explee autenticado y coordinación consumida no certificados.

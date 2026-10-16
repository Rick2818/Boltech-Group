# Retiro de despachadores comerciales antiguos — 16 octubre 2026

## Resultado y criterio de aceptación

Responsable: implementación técnica por instrucción de Ricardo. Retirar los ejecutores comerciales obsoletos antes de fusionar ASMAS, sin tocar Wompi. Base revisada: `a5948e4a27fcca84fa01588223a68fcc71418d7e` de main. Esta fase no acredita retiro completo ni autonomía comercial.

## Componentes eliminados

Se revisaron imports, llamadas desde API, scripts npm, workflows, configuración y pruebas. Los siguientes 17 scripts pertenecen al despacho/cadencias antiguos, no al ejecutor vigente de ASMAS:

- `scripts/outbound/campaign_engine.mjs`
- `scripts/outbound/commercial_automation_engine.mjs`
- `scripts/outbound/dispatch_custom_agent_test.mjs`
- `scripts/outbound/dispatch_daily_pipeline.mjs`
- `scripts/outbound/dispatch_harvard_clean_exit.mjs`
- `scripts/outbound/dispatch_hot_leads_closer.mjs`
- `scripts/outbound/dispatch_peace_of_mind_followup.mjs`
- `scripts/outbound/master_fiduciary_b2b_engine.mjs`
- `scripts/outbound/poll_explee_hot_leads.mjs`
- `scripts/outbound/prepare_impact_2_batch.mjs`
- `scripts/outbound/run_cron_hunter.mjs`
- `scripts/outbound/send_reply_ivan_pavlovic.mjs`
- `scripts/outbound/send_reply_james_kramer.mjs`
- `scripts/outbound/send_reply_lucjan_kisiel.mjs`
- `scripts/outbound/send_smtp_dispatch.mjs`
- `scripts/outbound/sync_hot_leads_tracking.mjs`
- `scripts/outbound/test_dispatch.mjs`

Se elimina `npm run hunter`. La única llamada externa al conjunto eliminado era el despachador de `api/index.js`; `/api/dashboard/trigger-dispatch` ahora devuelve HTTP 410 con `LEGACY_COMMERCIAL_RETIRED`, incluso con `dryRun=false`, sin cargar transportes ni tocar el pipeline. Se conserva la respuesta explícita de retiro para clientes antiguos.

Motivo: precios retirados, textos preescritos y claims no comprobados; destinatarios fijos; escrituras locales competidoras; hunter finalizaba con exit 0 ante fallos. No se ejecutó ninguno de estos scripts para retirarlos. Su código queda recuperable en Git; no se mueven ejecutores a una carpeta todavía ejecutable.

## Componentes preservados y siguiente fase

| Componente | Motivo y condición antes de retirar |
|---|---|
| Wompi, API de pagos, configuración, MCP de pagos y registros financieros | Protegidos. Cero cambios a archivos de pagos, secretos o datos; no se realizan cobros ni reembolsos. |
| `api/lead.js` y recepción web | Los formularios y el widget dependen de esta entrada; migrar UI/consumidores y probar persistencia antes de retirar. |
| `api/partners.js`, ejecutores RSI y Mercadeo | Multiplexor activo con cron, salud y coordinación compartidos; no sustituir por 410 global. |
| `api/a2a.js`, agent-card, Airtable y CRM | Contratos e integraciones compartidas; revisar consumidores y retirar coordinadamente lo exclusivo del legado. |
| `api/intel.js` | PR #64 sigue abierto y en conflicto; contrastar dependencias actuales, incluida investigación MCP, antes de integrar su retiro. |
| `autonomous_hunter.mjs`, `autonomous_opportunity_engine.mjs` | Clases antiguas sin el cron retirado; hunter todavía importado por prueba histórica de cold starts. Migrar esa cobertura antes de eliminarlas. |
| Adaptadores Apollo y entradas Explee restantes | Revisar individualmente antes de la siguiente fase; no borrar por nombre ni asumir que su presencia acredita integración ASMAS. |
| MCP Airtable local y cockpit históricos | Revisar conexiones y consumidores; sus fallbacks/fixtures no acreditan actividad real. No borrar almacenes existentes. |
| Documentos históricos y pipeline/data | Se conservan como historial, no como órdenes operativas. |

Se conserva el cron Vercel vigente y el watchdog ASMAS, sin duplicarlos. No se fusiona la arquitectura comercial nueva en esta fase. No se debe fusionar PR #64 a ciegas: nació sobre un main anterior y ya hubo revisiones por cortar recepción y rutas compartidas.

## Verificación

- `npm ci --ignore-scripts --no-audit --no-fund`: instalación completada con lockfile intacto.
- `npm run build`: sintaxis aprobada de 161 módulos de servidor/scripts.
- Primera batería: **62/62 PASS** (retiro HTTP, gobernanza, watchdog ASMAS, ejecutores RSI, Mercadeo, rutas comerciales, recepción web y regresión de pagos/Wompi con proveedores aislados).
- Segunda batería: **100/100 PASS** (Apollo, seguimiento e investigación RSI-01, cierre RSI-03, handoffs, estado de agentes, campaña SDR y coordinación).
- Total: **162/162 pruebas aprobadas**; no se enviaron correos ni se hicieron cobros en estas pruebas.
- Búsqueda de imports relativos JS/MJS: sin módulos faltantes. Diff revisado por lista de cambios permitidos; librerías de pagos, workflow Wompi, Vercel, MCP de pagos, pipeline/data y lockfile sin cambios.
- En `api/index.js` se cambia exclusivamente la rama de despacho antiguo; construcción de Wompi y ramas de pagos permanecen idénticas.
- Se añade la prueba de retiro al workflow Governance existente; no se crea un cron ni un agente.

Evidencia local previa a publicación. CI y producción deben verificarse por separado; no presentar esta batería como ejecución productiva ni retiro total del legado.

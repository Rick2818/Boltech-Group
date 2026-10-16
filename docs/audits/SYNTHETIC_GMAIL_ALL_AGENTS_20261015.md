# Cliente Sintético — Gmail y agentes, 15 octubre 2026

Responsable: ChatGPT / Codex. Autorización: Ricardo, prueba final con Gmail y todos los agentes usando Cliente Sintético. Identificador: QA-20261015-2118.

## Resultado observado

| Comprobación | Resultado | Alcance |
|---|---|---|
| Gmail de Boltech | PASS | Envío y lectura reales de un mensaje interno |
| RSI-01, RSI-02, RSI-03 y MARKETING | PASS en pruebas | Orquestador ADK y ejecutores con adaptadores simulados |
| Dirección | PASS en pruebas | Firmas, aprobación, cola y recibos de aviso simulados |
| Traspasos, deduplicación y conciliación | PASS en pruebas | Sin utilizar oportunidades reales |
| Entrega E1–E4 y recuperación QA | SYNTHETIC_PASS_ONLY | Recibos simulados, dos escenarios |
| Disponibilidad del servicio Vercel | INFRA_PASS | No certifica flujo comercial de cliente |

## Correo real

Cuenta remitente y destinataria verificada mediante perfil y lectura de encabezados: `ricardo.boltechgroup@gmail.com`.
Asunto: `[CLIENTE SINTÉTICO] Boltech — prueba final Gmail y agentes — QA-20261015-2118`.
Gmail messageId y threadId: `1a142b8b416b2fc3`.
Resultado inicial y readback: etiquetas `SENT` e `INBOX`; cuerpo recuperado contiene CLIENTE SINTÉTICO e identificador QA.
Fecha de envío: 2026-10-16T03:19:23Z (15 octubre, 21:19:23 SV).

El envío se realizó mediante el conector Gmail autenticado de Boltech, no mediante el despachador de Vercel. Esto prueba transporte real y recepción en la misma cuenta; no prueba lectura automática de este mensaje por los agentes. No se contactó a prospectos reales. No se debe generar una venta, cobro ni cierre a partir de este correo.

## Pruebas de los agentes

Checkout local de main: `6f4452e1a6b956f858bddf9585ef42c150b15137`. Dependencias instaladas con `npm ci --ignore-scripts --no-audit --no-fund`.
Comando ejecutado: `node --test` con los 16 archivos siguientes. Salida observada: **108 tests, 108 pass, 0 fail, 0 skipped; exit code 0**.

- tests/test_google_adk_agents.mjs
- tests/test_rsi_agent_executor.mjs
- tests/test_rsi_handoff.mjs
- tests/test_commercial_relay.mjs
- tests/test_interagent_coordinator.mjs
- tests/test_interagent_alternatives.mjs
- tests/test_rsi_marketing_cycle.mjs
- tests/test_marketing_sales_support.mjs
- tests/test_marketing_specific_requests.mjs
- tests/test_marketing_trace.mjs
- tests/test_marketing_maintenance.mjs
- tests/test_director_notifications.mjs
- tests/test_rsi03_closing.mjs
- tests/test_sdr_dispatch.mjs
- tests/test_client_delivery_certification.mjs
- tests/test_client_delivery_rehearsal.mjs

Las pruebas comprueban las cuatro identidades existentes, ausencia de llamadas a modelos pagados, apoyo de Mercadeo a los tres vendedores, aprobación individual de Dirección, recuperación tras reinicio/fallo, exclusión de Cliente Sintético del flujo real, conciliación sin reenvío y prohibición de cierre sin pago verificado. Los contratos se ejercitan con proveedores inyectados/simulados; los resultados no constituyen recibos de ejecución productiva de cada agente.

## GitHub Actions

Se reejecutó el workflow existente de certificación sin crear cron:
[trabajo 116793193285](https://github.com/Rick2818/Boltech-Group/actions/runs/38765754748/job/116793193285), completado con success.
[Artifacts](https://github.com/Rick2818/Boltech-Group/actions/runs/38765754748/artifacts/12022494201).

Resultado CI: **15 PASS, 0 FAIL**; escenario normal PASS y recuperación QA PASS en dos intentos, con E4_RSI RECOVERED. Probe de Vercel: `INFRA_PASS`, `productionReachable=true`, `customerEvidence=false`. Esta reejecución usa un checkout histórico del workflow; las 108 pruebas locales corresponden al main indicado arriba. No confundir ambos conjuntos ni sus SHAs.

## Conclusión y límite

PASS para el correo interno real, pruebas simuladas de todos los roles y recuperación sintética. **No se certifica un único recorrido real Gmail → todos los agentes → cierre → pago → entrega**: el correo sintético está excluido por diseño de los traspasos comerciales productivos. No se deshabilitaron estas protecciones. Para acreditar ese recorrido hará falta un entorno QA aislado que admita explícitamente las etapas sintéticas con recibos por rol, o un comprador real autorizado con sus aprobaciones y evidencia.

La verificación OAuth desde Vercel se conserva por separado en [GMAIL_OAUTH_CONNECTION_VERIFICATION_20261015.md](GMAIL_OAUTH_CONNECTION_VERIFICATION_20261015.md). No se modificaron credenciales, campañas ni pagos por esta prueba.

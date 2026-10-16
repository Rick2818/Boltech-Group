# Gmail + agentes existentes — recorrido técnico aislado

Fecha: 15 octubre 2026, America/El_Salvador. Caso: **QA-20261015-2125, Cliente Sintético**. Responsable: ChatGPT / Codex, autorizado por Ricardo.

## Resultado y criterio

**ISOLATED_TECHNICAL_CHAIN_PASS**: entrada Gmail real → ejecución del código RSI-01 → correo con recibo → MARKETING → correo → RSI-02 → correo → RSI-03 → correo → revisión de Dirección → correo final. Se verificaron los digests y la lectura de cada mensaje antes de avanzar. Las cuatro identidades ADK utilizaron `createRsiExecutor().run` del código existente; no se sustituyeron sus resultados por respuestas prefabricadas.

Este es un recorrido técnico con supervisión del operador, almacenamiento local QA y transporte por el conector Gmail. **No certifica operación comercial autónoma en Vercel ni los traspasos comerciales productivos entre compradores y agentes.** El harness que enlaza etapas es independiente del relay comercial; sus exclusiones de Cliente Sintético permanecen vigentes.

## Evidencia verificable

Archivo de recibos: [ISOLATED_GMAIL_AGENT_CHAIN_20261015.json](ISOLATED_GMAIL_AGENT_CHAIN_20261015.json). Ejecutor QA: [isolated_gmail_agent_trial.mjs](../../scripts/ops/isolated_gmail_agent_trial.mjs). Código de aplicación usado: `a7db6da17cffed700d35b640174616df04899bd2`, más el nuevo script aislado.

| Etapa | Gmail de entrada | Ejecución observada |
|---|---|---|
| RSI-01 | `1a142b8b416b2fc3` | COMPLETED técnico; conserva LIVE_APOLLO_GMAIL_HISTORY_REQUIRED |
| MARKETING | `1a142c104e52fa13` | COMPLETED; genera soporte para los tres roles sobre datos QA |
| RSI-02 | `1a142c11111e3548` | COMPLETED; analiza timestamps reales del correo interno y persiste informe |
| RSI-03 | `1a142c11ac3de6e1` | COMPLETED técnico; espera socio, costos y caso de cierre aprobado |
| DIRECTORA | `1a142c129a75c008` | Revisa cuatro recibos; HOLD_SYNTHETIC_NOT_A_SALE |
| FINAL | `1a142c134b952b88` | Cadena de seis recibos verificada |

Correo de resumen adicional: `1a142c1c70718281`, enviado a la misma cuenta de Boltech con resultado y límites. Todos los mensajes de la cadena se enviaron de `ricardo.boltechgroup@gmail.com` a esa misma cuenta y se leyeron con etiquetas SENT e INBOX. La entrada se reutilizó de la prueba anterior, sin duplicarla. Hubo cinco nuevos correos de traspaso y un resumen final.

Digest final: `715ce81b9a8dc7d45fda237bd7174742aab69b9e3b9326e66e4bcb5f7ee7c10e`. Los seis digests se recalcularon de forma independiente; cada recibo enlaza al anterior y al mensaje real que lo transportó.

## Aislamiento y recuperación

- Se instanciaron las cuatro identidades existentes con `@google/adk`, cero llamadas a modelos. Dirección usó el coordinador existente para comprobar la exclusión de un cierre QA; no se creó un quinto agente LLM.
- Los adaptadores QA escriben archivos persistentes y hacen readback. No conectan al Redis, Airtable, Apollo ni Wompi productivos. El script bloquea fetch y elimina credenciales del proceso. Solo el operador usa el conector Gmail para los mensajes internos.
- Una comprobación adicional en un proceso nuevo, a las 2026-10-16T03:30:24.550Z, recuperó los cuatro recibos únicamente con GET desde disco: reused=true, cero escrituras y cero llamadas a proveedores. El JSON conserva ese resultado en independentProcessRecovery.
- Cada rol se ejecutó en un proceso separado. Una segunda instancia recuperó su recibo con `reused=true`, igualdad de contenido y sin repetir trabajo. Esto comprueba recuperación después de una terminación normal, no recuperación después de un fallo en medio de una mutación.
- Los datos no afirman un comprador real: el único lead está marcado QA y Cliente Sintético. Los seguimientos comerciales están deshabilitados en esta ejecución QA. No se ejecutó el seguimiento productivo pendiente de A y L.
- La cola de Dirección quedó vacía de cierres comerciales; el intento de reportar cierre QA fue rechazado con INTERAGENT_OPPORTUNITY_EXCLUDED. Cero pagos, ingresos o cargos; ninguna aprobación de cotización de cliente.

## Límites que permanecen

COMPLETED significa que el ciclo técnico terminó y conservó su recibo; no elimina sus blockers. En RSI-01 falta evidencia comercial Apollo/historial; RSI-03 conserva WAITING_VERIFIED_PARTNER, COST_EVIDENCE_INCOMPLETE y WAITING_QUALIFIED_APPROVED_CASE. Los proveedores comerciales locales están vacíos deliberadamente y no acreditan integraciones comerciales reales. La aceptación del análisis RSI-02 se limita a datos QA internos; no es aceptación de un cliente.

Los correos se enviaron mediante el conector Gmail, no mediante `createSdrGmail` desde Vercel; el operador encadenó los mensajes y lanzó cada proceso. Por tanto no es prueba de activación automática por Gmail, cron ni coordinación cloud autónoma. La autenticación OAuth de Vercel está certificada por separado en [GMAIL_OAUTH_CONNECTION_VERIFICATION_20261015.md](GMAIL_OAUTH_CONNECTION_VERIFICATION_20261015.md).

Para certificar el recorrido comercial autónomo falta una ejecución cloud aislada con identidad de comprador QA, almacenamiento/proveedores separados y recibos de traspaso de negocio; no se deben retirar las protecciones de producción para lograrlo. La prueba de esta noche acredita el recorrido técnico descrito, con sus restricciones explícitas.

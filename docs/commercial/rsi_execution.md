# Ejecución autónoma RSI — configuración productiva

Fecha: 3 octubre 2026. Responsable: ChatGPT / Codex. Solicitante: Ricardo Ernesto Bolaños Hernández.

## Dos capas con funciones distintas

Los tres agentes de ventas ya existían como automatizaciones de ChatGPT, habilitadas con Apollo, Gmail, Airtable y GitHub. Se verificaron sus instrucciones, calendarios y registros actuales. No son DOTS. Un run solicitado o una fecha last_run_time no acredita por sí solo trabajo persistido.

La aplicación añade tres ejecutores técnicos acotados en Vercel. Consumen fuentes reales y registran resultados privados. Los agentes consultivos conservan investigación, interpretación, propuestas y acciones comerciales previamente autorizadas; el ejecutor no los sustituye ni ejecuta prospección.

| RSI | Herramientas del ejecutor Vercel | Resultado operativo |
|---|---|---|
| RSI-01 | Airtable Leads y RSI Agent Work | Revisión de integridad de cohortes, comprador/contacto/problema y bloqueo explícito hasta relectura de historial Apollo/Gmail por el agente consultivo |
| RSI-02 | Cola RSI y análisis de registros de respuesta aceptados | Si no hay datos aceptados registra dependencia. Con alcance estructurado calcula muestra, respuesta automática/útil y resolución; persiste informe privado y estado AUDIT_ANALYZED |
| RSI-03 | Partners, Referrals, Operating Costs, Payment Orders y configuración del piloto | Revisa referidos reales/QA, evidencia de costos, cobro asentado con evidencia proveedor y habilitación del piloto; no confirma al proveedor ni crea cobros/comisiones |

## Recibos e idempotencia

RSI Agent Work conserva los estados comerciales existentes y añade cinco campos independientes: Execution Run ID, Execution State, Execution Started At, Execution Finished At, Execution Receipt. El recibo JSON v1 contiene actor, herramientas, referencias, acciones, resultado, bloqueos y próximo paso. Los recibos de las automatizaciones se conservan además como trabajos RUN:<runId>; los ejecutores guardan historial durable en Redis por RSI/cycleId.

Los ejecutores usan lease Redis de 120 segundos por RSI, ledger persistente por cycleId y confirmación del lease al finalizar. Un cycleId terminado devuelve el mismo recibo sin repetir trabajo. Una escritura incierta, lease perdido, ledger RUNNING o marcador RUNNING/UNKNOWN exige conciliación. No se reintenta un POST incierto automáticamente. El ledger no usa RAM como fallback. La protección Redis cubre ejecutores de la aplicación; los marcadores de los agentes ChatGPT son conservadores y NO un mutex transaccional compartido. No existe garantía exactly-once entre todas las plataformas ni envío autónomo por estos endpoints.

COMPLETED significa ciclo técnico registrado. BLOCKED conserva lecturas/acciones parciales y causa. Ninguno demuestra cliente, auditoría comercial completa, pago o entrega. La telemetría valida el contrato del recibo y la persistencia; no certifica independientemente la veracidad del texto que otro operador introduzca.

## Contrato privado de la aplicación

- GET /api/partners?action=rsi-agents: diagnóstico agregado, autenticación administrativa, no-store, sin PII ni texto del cliente. Diferencia VERCEL_EXECUTOR y SALES_AUTOMATION. Incluye antigüedad del recibo; no infiere continuidad del scheduler.
- POST /api/partners?action=rsi-execute: {rsi,cycleId}, misma autenticación; ejecuta solo el rol declarado. Usa Redis/Airtable existentes. Resultado confirmado o error sanitizado. No habilita campañas ni envía mensajes.

GitHub ejecuta los tres roles desde el workflow MIT existente de 09:00 SV y desde aceptación productiva tras cambios del ejecutor. No hay otro cron. Ambos comparten grupo de concurrencia. Se guardan artefactos sanitizados y el detalle permanece privado. GitHub schedule no ofrece puntualidad garantizada. Los calendarios consultivos vigentes se conservan: RSI-01 horario; RSI-02 lunes-viernes 10:00 SV; RSI-03 lunes-viernes 11:30/16:30 SV.

## Auditoría de respuestas aceptada

Una tarea existente para RSI-02 puede usar Status=AUDIT_ACCEPTED y Authorization como JSON:

```json
{"accepted":true,"kind":"RESPONSE_LOG_ANALYSIS","evidenceRef":"referencia-privada-del-registro-real","samples":[{"receivedAt":"fecha ISO real","automaticResponseAt":null,"usefulResponseAt":null,"resolvedAt":null}]}
```

Esto describe el contrato, no datos de producción ni una aceptación creada. Los timestamps deben proceder de un registro real autorizado. No se simula comprador. El análisis mide tiempo transcurrido; no ajusta horario laboral y no estima ROI/SLA. Otros tipos de auditoría requieren implementar y acordar su propio alcance. Se consume como máximo una tarea aceptada por ciclo; cambios dudosos se concilian antes de reintentar.

## Límites y pendientes

La revisión de cuenta no valida decisor o necesidad por un simple campo CRM. Historial Apollo/Gmail, auditoría aceptada con datos, aprobación de socios, facturas y pago genuino siguen dependiendo de sus fuentes. paymentEnabled=false sigue bloqueando el checkout del piloto. HubSpot conectado al operador no equivale a credencial de la aplicación. No se incluye envío comercial nuevo, contrato, gasto, comisión ni cobro.

La configuración e instalación no bastan: aceptación requiere tres ciclos reales registrados, lectura autenticada, rechazo público y deployment vigente. Evidencia final en docs/audits/RSI_EXECUTION_2026-10-03.md.


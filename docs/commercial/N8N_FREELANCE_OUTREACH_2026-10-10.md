# n8n freelance — registro de prospección comercial (10 octubre 2026)

**Responsable:** Boltech Group / Ricardo Bolaños. **Objetivo:** primer cobro real verificable, no mero volumen de correos.

## Fuente de verdad y alcance

La arquitectura documentada en `docs/commercial/rsi_execution.md` y `docs/commercial/primer_cobro.md` sitúa la operación RSI-01 y la evidencia de trabajo en **Airtable (Leads / RSI Agent Work)**, la comunicación saliente en **Gmail**, el diagnóstico programado en **GitHub Actions**, y el seguimiento técnico en Vercel/Redis. **HubSpot es una integración adicional, NO un prerrequisito documentado para registrar estos envíos.** Esta conclusión es documental y no prueba que los cinco registros ya estén sincronizados con Airtable.

## Envíos efectivamente aceptados por Gmail

| # | Prospecto | Destinatario | Fecha SV | Evidencia Gmail (ID de mensaje) | Estado |
|---|---|---|---|---|---|
| 1 | LeadFlow AI — Martin | martoudoh1@gmail.com | 2026-10-09 | `1a1229a7f82a5c6b` | SENT |
| 2 | KB DIGITAL | info@kbgroup.es | 2026-10-10 | `1a1281d10c54cc94` | SENT |
| 3 | Raj AI Automation (manufacturing) | zapixai2@gmail.com | 2026-10-10 | `1a1281ebccfe36d1` | SENT |
| 4 | Yusuf Maged | Yusuf.maged2006@gmail.com | 2026-10-10 | `1a1282685cdc10e8` | SENT |
| 5 | Henan Zhuowei New Energy — ZVEPOW | info@zvepow.com | 2026-10-10 | `1a1283a4d012d6b4` | SENT |

**Conteo validado:** 5 aceptados por Gmail; 4 de ellos enviados el 10 de octubre, 1 el 9. `SENT` demuestra aceptación del envío por Gmail; no acredita entrega al buzón, respuesta, aceptación comercial, sincronización con Airtable ni cobro. El intento a Xavier fue bloqueado: **no incluir en enviados**.

Los correos son presentaciones iniciales, no cotizaciones ni contratos; confirmar si las solicitudes aún están abiertas antes de insistir.

## Estado de integración del proceso comercial

- **Confirmado:** envíos individualizados en Gmail; objetivo y proceso RSI documentados en el repositorio.
- **No verificado:** presencia y etapa de cada destinatario en Airtable Leads / RSI Agent Work; relación entre Gmail y el recibo RSI; disparo del flujo n8n; ingesta automatizada de respuestas; avance hasta `replied`, `meeting`, `proposal`, `paid`.
- **No procede inferir:** que la ausencia en HubSpot equivale a una falla de RSI; tampoco que la existencia de esta documentación acredita ejecución o sincronización.
- **Pendiente obligatorio:** buscar los cinco prospectos en Airtable por correo exacto, evitar duplicados, registrar canal, fuente, fecha de contacto, evidencia del problema (si existe), Gmail message ID, estado `CONTACTED`, próximo paso y fecha. Mantener `UNKNOWN` cuando falte dato.
- **Control:** comprobar en el ciclo comercial RSI-01 el recibo real para cada contacto, sin regenerar envíos ni contar QA como leads.
- **Seguimiento:** revisión el lunes 12 de octubre de 2026, 09:00 SV, de respuestas genuinas y próximos pasos. Preparar, no enviar automáticamente, seguimientos de contactos sin respuesta y solo si procede por vigencia/solicitud.
- **Pagos:** registrar ventas únicamente después de confirmación genuina del proveedor de cobro. La prueba Wompi de USD 1 no es venta comercial.

## Referencias operativas

- `docs/commercial/rsi_execution.md`
- `docs/commercial/primer_cobro.md`
- `.github/workflows/mit_commercial_9am.yml`

Este archivo registra evidencia observada en esta conversación; **no ejecuta integraciones ni cambia datos productivos**.

## Conciliación ejecutada y releída — 10 octubre 2026

**Resultado comprobado:** 5/5 contactos en Airtable Leads, todos con Commercial Stage = `Contacted`, Gmail message ID en Notes, Next Action para 2026-10-12 y origen de n8n. Cada lead tiene una fila correspondiente `N8N_OUTREACH:<lead-id>` en `RSI Agent Work`, RSI-01, estado `CONTACTED_AWAITING_REPLY`. Se verificó la lectura de ambas tablas después de escribir. Se aplicó upsert por correo exacto en Leads y por Work ID en la cola; LeadFlow AI ya existía y se actualizó, sin duplicarlo.

| Prospecto | Airtable Lead ID | RSI Agent Work ID |
|---|---|---|
| LeadFlow AI | `recwRh4cvq9Xon63G` | `recFBJKQHv4ZpCluX` |
| KB DIGITAL | `recN7MaYBsclDG7mW` | `recRD2Py8hU3Vp8Hn` |
| Raj AI Automation | `reccnTBCDp9riKEey` | `reccPftcfjWuhaggN` |
| Yusuf Maged | `recfbO6OnWyDrUYN4` | `recqKxqR9Lzr9g225` |
| ZVEPOW | `rec3Aohb4XXjQDTEB` | `rec33SDv0EwZ7heiT` |

**Límites:** se verificó conciliación de los registros, NO ejecución posterior del ciclo autónomo RSI/n8n, ni lectura automatizada de respuestas, apertura de las vacantes, recepción por destinatario, contratos ni ingresos. El estado `RESEARCH_ONLY` de calidad de datos se mantiene hasta validar al comprador. Ningún email nuevo fue enviado durante la conciliación.

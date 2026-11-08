# Las 10 integraciones — fichas con fuente verificada

Fecha: 2026-11-05 · Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION`
Precio: ninguna integración se cotiza antes de la validación técnica.

Cada ficha vive en `commercial/integraciones/<id>.md` (ES) y
`commercial/integraciones/en/<id>.md` (EN). El índice legible por máquina está en
`commercial/integraciones/manifest.json`.

---

## Qué se verificó y qué no

**Verificado el 2026-11-05:** que la documentación oficial de cada proveedor existe y responde
HTTP `200` (HubSpot y Notion redirigen con `308` a su URL final, que también responde `200`).

**No verificado:** ninguna conexión real, ningún límite numérico, ninguna credencial, ningún
permiso concedido y ningún dato transferido. Eso es exactamente lo que falta en la validación
técnica de cada ficha.

---

## Tabla

| # | Integración | Fuente oficial | HTTP | Tareas de operaciones |
|---|---|---|---|---|
| 1 | Airtable | https://airtable.com/developers/web/api/introduction | 200 | Pedidos, stock |
| 2 | Google Sheets | https://developers.google.com/sheets/api | 200 | Pedidos, facturas, stock |
| 3 | Gmail | https://developers.google.com/gmail/api | 200 | Pedidos, facturas |
| 4 | Google Drive | https://developers.google.com/drive/api | 200 | Facturas |
| 5 | Telegram | https://core.telegram.org/bots/api | 200 | Pedidos, stock |
| 6 | Supabase | https://supabase.com/docs/guides/api | 200 | Pedidos, stock |
| 7 | n8n | https://docs.n8n.io/ | 200 | Las tres (orquestación) |
| 8 | HubSpot | https://developers.hubspot.com/docs/api-reference/latest/overview | 200 (vía `308`) | Ninguna: registra la solicitud |
| 9 | Slack | https://api.slack.com/ | 200 | Las tres (aprobaciones) |
| 10 | Notion | https://developers.notion.com/guides/notion-api/quick-start | 200 (vía `308`) | Las tres (alcance y entregables) |

---

## Cómo leer cada ficha

Cada ficha responde seis preguntas:

1. Para qué sirve en nuestro plan.
2. Qué tareas de operaciones puede servir.
3. Qué datos tocaría exactamente.
4. Cómo se autentica (según su documentación).
5. Qué límites y riesgos declara.
6. Qué hay que validar antes de cotizar.

Y cierra con los límites de la ficha: no hay conexión probada, no hay límite numérico
verificado, no hay afiliación ni certificación implícita, y no hay credenciales ni datos.

---

## Reglas comunes

- Ninguna integración se conecta sin validarla técnicamente.
- Ninguna integración se cotiza sin revisar el alcance.
- Ninguna credencial se guarda en el repositorio ni se imprime en logs.
- El agente no conecta, no autoriza y no gasta: solo describe y propone.
- Los datos personales que toque cualquiera de estas integraciones caen bajo la base legal y el
  destino que todavía no están definidos (ver `docs/DECISIONES-LEGALES.md`).

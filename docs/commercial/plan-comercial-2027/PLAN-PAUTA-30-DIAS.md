# Plan de pauta de 30 días — Boltech Group

Fecha: 2026-11-05 · Presupuesto: **US$0** · Estado: `DRAFT_FOR_OWNER_APPROVAL`
Alcance: solo canales orgánicos segmentados. Sin gasto, sin envío externo, sin publicación
automática. Requiere autorización explícita del propietario para activar cada canal.

---

## 1. Objetivo

Conseguir las primeras **10 oportunidades reales** y **3 evaluaciones escritas** solicitadas
(hipótesis del plan, no pronóstico), usando únicamente el material ya aprobado y los canales
cerrados por defecto.

## 2. Canales (orden de activación)

| Semana | Canal | Estado actual | Acción |
|---|---|---|---|
| 1 | `organic-web` | cerrado | Publicar las 3 tareas en la home (ya preparadas en `site/home-operaciones.html`) |
| 1 | `institutional-linkedin` | cerrado | 1 post/semana por tarea, con CTA a `/solicitud?tarea=...` |
| 2 | Comunidades (grupos FB/LinkedIn/WhatsApp) | no implementado | 3 respuestas útiles/semana, sin spam |
| 3 | YouTube/TikTok (video corto) | no implementado | 1 demo de 15 min por tarea |
| 4 | Reddit/Quora | no implementado | 2 respuestas técnicas/semana |

No se activan `a2a`, `marketplaces` ni `partner-programs` en este tramo.

## 3. Calendario (30 días)

| Día | Canal | Pieza (del kit) | CTA |
|---|---|---|---|
| 1 | LinkedIn | Operaciones: registro de pedidos | `/solicitud?tarea=pedidos` |
| 3 | LinkedIn | Operaciones: conciliación de facturas | `/solicitud?tarea=facturas` |
| 5 | LinkedIn | Operaciones: alertas de stock | `/solicitud?tarea=stock` |
| 7 | Grupo FB | Respuesta a pregunta de pedidos | `/solicitud?tarea=pedidos` |
| 8 | Web | Publicar home con sección de operaciones | `/solicitud` |
| 10 | LinkedIn | Caso por función: operaciones | `/solicitud?tarea=operaciones` |
| 12 | Grupo FB | Respuesta a pregunta de facturas | `/solicitud?tarea=facturas` |
| 14 | LinkedIn | Comparativa honesta (implementación vs. plataforma) | `/solicitud` |
| 16 | Comunidad WhatsApp | Compartir guía de evaluación | `/solicitud` |
| 18 | YouTube | Demo de 15 min: pedidos | `/solicitud?tarea=pedidos` |
| 20 | LinkedIn | Integración propuesta: Google Sheets | `/solicitud` |
| 22 | Reddit | Respuesta técnica sobre conciliación | `/solicitud?tarea=facturas` |
| 24 | LinkedIn | Oferta: implementación de un flujo | `/solicitud` |
| 26 | TikTok/Reels | Demo corta: stock | `/solicitud?tarea=stock` |
| 28 | LinkedIn | Recap de mes + métricas propias | `/solicitud` |
| 30 | LinkedIn | Cierre de tramo + invitación a evaluación | `/solicitud` |

## 4. Reglas de publicación (no negociables)

1. Ninguna pieza sale sin aprobación humana de Ricardo.
2. Sin claims prohibidos: sin porcentajes de resultado, sin "el mejor", sin garantías, sin testimonios.
3. Precios solo de referencia, con nota "no ofertas finales".
4. Sin envío masivo ni consumo de Connects.
5. Cada publicación se registra con origen para medir con `commercial-metrics`.
6. Sin gasto: no se activan créditos de anuncios sin autorización escrita.

## 5. Métricas de éxito (30 días)

| KPI | Meta | Fuente |
|---|---|---|
| Oportunidades reales registradas | 10 | `commercial-metrics --tenant boltech` |
| Evaluaciones escritas solicitadas | 3 | recibos de captura |
| Publicaciones realizadas | 15 | registro manual |
| Respuestas en comunidades | 12 | registro manual |
| Visitas a `/solicitud` | medible con conector aprobado | pendiente de analítica |

## 6. Qué NO se hace en este tramo

- No se activan anuncios pagados.
- No se abren `marketplaces` ni `partner-programs`.
- No se envían mensajes A2A externos.
- No se publica en producción sin autorización (sigue `publishingEnabled: false`).

## 7. Aprobación

| Decisión | Responsable | Estado |
|---|---|---|
| Activar canales orgánicos | Ricardo | pendiente |
| Aprobar calendario | Ricardo | pendiente |
| Autorizar publicación | Ricardo | pendiente |
| Medir y reportar | Agente | automático |

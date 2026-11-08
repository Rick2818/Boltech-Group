# Auditoría inicial — Leo Autonomous Revenue Engine

Fecha: 2026-11-08  
Repositorio inspeccionado: `Rick2818/Plan-Comercial-tipo-Relevance-AI`  
Rama: `feature/leo-platform-connectors`  
Commit observado: `16eb252`

## Hallazgo crítico de alcance

El repositorio solicitado en el brief es `Rick2818/Boltech-Group`, pero el
checkout actual apunta a `Rick2818/Plan-Comercial-tipo-Relevance-AI`. Conforme a
las reglas del proyecto, no se modificó el repositorio externo de Desktop ni se
alteró Vercel. Esta auditoría se limita al repositorio de trabajo actual.

## Inventario con evidencia

| Área | Evidencia | Estado real | Riesgo / bloqueo |
|---|---|---|---|
| Leo web/API | `src/leo_sales_runtime.mjs`, `functions/api/index.js` | Implementado y desplegable | No persiste CRM ni ejecuta cierre |
| Mercadeo | `skills/leo-*`, `src/leo_marketing_context.mjs` | Conocimiento y borradores | No publica ni envía campañas |
| Explee | `src/explee_client.mjs`, `functions/api/explee.js`, `config/explee-leo.json` | Adaptador oficial de lectura | Proyecto/búsqueda/outreach con gates; búsqueda y envío desactivados |
| Upwork | `src/leo_platform_connectors.mjs`, `/api/platform` | Lectura allowlisted | Token/org y OAuth exactos pendientes; no propuestas ni Connects |
| Freelancer | `src/leo_platform_connectors.mjs`, `/api/platform` | Código de lectura con gate | `FREELANCER_API_ENABLED` permanece cerrado; no ofertas ni créditos |
| CRM Supabase | `commercial/integraciones/supabase.md` | Documentación solamente | No existe conexión, migración ni tabla verificada |
| Estado comercial | Conversion runtime y Sales Dot | Estados en memoria/respuesta | No hay fuente de verdad persistente |
| Scheduler/cola | `docs/PLAN-DE-ACCION.md` | No implementado; no hay cron/worker | No existe operación 24/7 recuperable |
| Panel | `public/` | No existe panel CRM autenticado | No hay vista de pipeline ni historial |
| Wompi | `functions/api/payments.js`, tests Wompi | Flujo separado y protegido | No se modificó; verificación externa previa reporta credenciales inválidas |

## Clasificación de capacidad

### Implementado y probado localmente

- Calificación Sales Dot, validación de correo y resumen pendiente de aprobación.
- Guards de seguridad, consentimiento, rechazo, reembolso y autonomía.
- Material de mercadeo contextualizado sin claims no verificables.
- Lecturas allowlisted de Upwork/Freelancer con idempotencia, recibos y límite diario.
- Adaptador oficial de Explee con búsqueda y outreach cerrados.
- Pruebas sintéticas sin red para las integraciones.

### Preparado, pero no operativo en producción

- Lectura real de Explee: requiere proyecto seleccionado y verificación controlada.
- Lectura real de Upwork: requiere token MCP y `org_uid` confirmados.
- Lectura real de Freelancer: requiere auditoría, scopes y token autorizado.
- Persistencia Supabase: falta migración aplicada, URL y clave pública/servidor
  correctamente separadas.

### No implementado

- CRM central Supabase y RLS verificados.
- Motor persistente de oportunidades, propuestas, seguimientos y eventos.
- Scheduler → cola → ejecutor con locks, backoff y dead-letter queue.
- Panel autenticado de pipeline.
- Envío de propuestas/contactos y negociación autónoma.

## Gates que permanecen cerrados

- Explee: `searchEnabled=false`, `outreachEnabled=false`.
- Upwork/Freelancer: solo lectura; `LEO_PLATFORM_WRITE_ENABLED=false`.
- Sin consumo de Connects, créditos, presupuesto o campañas.
- Sin mensajes, propuestas, publicaciones, pagos ni contratación.

## Evidencia ejecutada

- `npm test`: 145/145 pruebas aprobadas antes de esta auditoría.
- `npm run check`: aprobado.
- No se usaron credenciales reales ni se hicieron llamadas de red a Upwork o
  Freelancer durante esta auditoría.

## Certificación

El sistema **no está certificado como Revenue Engine 24/7 ni como primera
facturación**. Está certificado únicamente en el perímetro local de seguridad,
Sales Dot, material de mercadeo y adaptadores read-only probados sintéticamente.
No se declara producción, persistencia Supabase, campaña activa ni conversión
real sin evidencia primaria.

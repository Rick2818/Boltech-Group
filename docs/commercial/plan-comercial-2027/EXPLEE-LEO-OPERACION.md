# Explee ↔ Leo: estado operativo y puerta de activación

Fecha: 2026-11-08

## Verificación realizada

- No existe un MCP de Explee conectado en esta sesión.
- Explee publica un MCP oficial en `https://api.explee.com/public/api/mcp`.
- Explee publica una API oficial en `https://api.explee.com/public/api/docs` y OpenAPI.
- El adaptador de este repositorio usa exclusivamente la API oficial; no usa el MCP comunitario.
- El adaptador está en modo lectura/revisión. No crea campañas, no inicia campañas, no aprueba campañas y no responde conversaciones.

## Capacidades comprobadas en producción

| Capacidad | Estado |
|---|---|
| Leo web /api?leo_sales=1 | Operativo |
| Voz Azure | Operativa, verificada previamente |
| WhatsApp entrante | Meta configurada; falta `META_WA_APP_SECRET` |
| Airtable/KV de leads | Configuración presente; cada esquema debe seguir verificándose |
| Resend | Secret presente; entrega depende del dominio/remitente |
| Wompi | OAuth, almacenamiento y escritura habilitados; pago solo se marca con verificación del proveedor |
| Explee | Sin `EXPLEE_API_KEY`; no activado |

## Variables de Cloudflare para la activación controlada

- `EXPLEE_API_KEY`: secret de la API oficial.
- `EXPLEE_INTERNAL_TOKEN`: secret para que solo un proceso autorizado lea el adaptador.
- `EXPLEE_PROJECT_ID`: proyecto Explee elegido.
- `EXPLEE_SEARCH_ENABLED`: debe permanecer `false` hasta aprobar el alcance y verificar saldo/costo.
- `EXPLEE_OUTREACH_ENABLED`: debe permanecer `false` hasta aprobar la configuración operativa.

## Decisiones pendientes antes de cualquier búsqueda o envío

1. Perfil de comprador: uno de los tres problemas actuales (pedidos, facturas o stock), tamaño/rol objetivo.
2. Países y canal: países concretos y correo Explee como canal inicial; no WhatsApp ni cold email legado.
3. Presentación vigente: confirmar el enlace/archivo institucional que puede usar Leo.
4. Frecuencia: máximo de mensajes y seguimientos por lead, con fechas y horario.
5. Exclusiones: clientes, oportunidades, contactos previos, bajas, competidores y dominios excluidos.
6. Condiciones: piloto de US$600 y custom desde US$900 como referencias sujetas a aprobación; ningún descuento automático.

La API key ya está cargada como secret. Hasta seleccionar el proyecto Explee y activar explícitamente la búsqueda, las pruebas son sintéticas y la producción permanece sin prospección.

## Concepto operativo adoptado

Para no cambiar lo que ya funciona ni inventar una oferta nueva, el concepto de prospección queda definido así:

> **Boltech ayuda a pequeñas empresas activas a ordenar y automatizar pedidos, facturas y stock con un piloto de alcance definido.**

Prioridad: fundadores y dueños de empresas de 1–20 empleados. Segmento secundario: responsables de operaciones, finanzas o administración en empresas de 21–50 empleados. Países: Estados Unidos, México y Colombia. La configuración revisable está en `config/explee-leo.json`; búsqueda y envíos continúan desactivados.

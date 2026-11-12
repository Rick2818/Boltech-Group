# Pedro / Pdro Imports: ensayo comercial del 12 noviembre 2026

Ejecutar `node scripts/ops/pdro_commercial_rehearsal.mjs` con Node 22 o posterior.
El ensayo usa el Worker real con respuestas de proveedor sintéticas, el intake
guiado, el validador de ficha y el sandbox de atención ya existente.
Solo permite HTTP a localhost; las plataformas externas se sustituyen dentro
del proceso. No utiliza secretos reales, Wompi, mensajes ni datos de clientes reales.

Países elegidos por el propietario: El Salvador (SV), Guatemala (GT), Panamá (PA),
Colombia (CO), México (MX) y Estados Unidos (US). El Worker aplica `geo_include`,
`geo_include_empty:false`, `location_hq:true` y `location_customer:false` a la
primera página de hasta diez empresas. Es una restricción sobre sedes, no sobre
países donde vende una multinacional. El recibo registra el filtro solicitado;
no afirma haber verificado por su cuenta cada ubicación devuelta.

Resultado local: 10 etapas de ensayo; 12 pruebas de integración y 11 de atención
aprobadas. Ocho mensajes HTTP iniciales y cinco consultas adicionales de catálogo,
resolución y recuperación. Fuente base: `085c3b5db4ca9f904169b5235089d424c107c205`.

La unificación de oportunidad, propuesta, seguimiento, aprobación y aceptación
final son fixtures explícitos del conductor del ensayo: no son un ejecutor
comercial nuevo ni certifican el sistema productivo. La aceptación del pedido
en el sandbox existente permanece PENDING. No se reactiva la fábrica, Agente 1,
RSI, cold email ni un cron.

El informe JSON, el diario persistido y la lectura posterior quedan en
`ops-output/pdro-commercial/`. Los resultados del sandbox de atención permanecen
en `ops-output/pdro-imports/`. No publicar esas carpetas como datos comerciales.

## Pendientes reales

- Probar los resultados geográficos reales después de desplegar el cambio.
- Corregir los errores de historial y tiempo de espera del chat comercial de Leo.
- Integrar y verificar calificación, borradores, seguimiento y aprobaciones reales.
- Comprobar pago, canal e inferencia IA y aceptación antes de certificar entrega.

Referencia de campos: https://api.explee.com/public/api/openapi.json,
esquema `PublicCompaniesFilters`, consultado el 12 noviembre 2026.

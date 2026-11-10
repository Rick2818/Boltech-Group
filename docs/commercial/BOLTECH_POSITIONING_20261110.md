# Boltech: propuesta de valor y CTA

Fecha: 10 noviembre 2026. Estado: implementación preparada; publicación no verificada.

## Compra que proponemos

Para una empresa pequeña que necesita ayuda con un cuello de botella, Boltech propone definir, adaptar y probar un flujo con sus herramientas. La entrada es registro, asignación y seguimiento de solicitudes de cotización. No se afirma superioridad tecnológica ni exclusividad.

CTA: **Quiero mi proceso funcionando →**. En inglés: **Get my workflow working →**.

Apoyo: una empresa, un flujo web, una integración sencilla. Piloto US$600; US$300 al iniciar y US$300 contra entrega verificada, con alcance aprobado. Consumo, mantenimiento y otras integraciones separados. Fuente: `config/commercial_pilot.json`, versión `2026-10-21-price-segment`. No cambia precios ni compromisos aceptados. Clic inicia conversación, no compra ni cargo.

La ventaja buscada es quitar al comprador trabajo de definición e implementación en un alcance pequeño y medible. Para que sea una ventaja demostrada hacen falta entregas reales, aceptación del cliente y mediciones; publicar este mensaje no demuestra esos resultados.

## Material y consumo por Leo

- `index.html`: entrada comercial y CTA.
- `por-que-boltech.html`: alcance, criterios de elección, piloto y siguiente paso, ES/EN.
- `sales-agent.html`: botón de encaje, objeción competitiva y prueba de entrega. Conserva voz e integraciones de la última carga proporcionada en esta sesión.
- `lib/boltech_positioning.js`: contexto compartido y cinco respuestas: competencia, entrega, encaje, siguiente paso y estimación de valor.
- `lib/leo_sales_runtime.js`: consume ese contexto en el sistema del modelo y responde a esas cinco intenciones antes del modelo.
- `cloudflare/leo-marketing-worker.mjs`: añade las mismas respuestas a la carga directa existente; otras consultas conservan su backend. No es un ejecutor de campañas, propuestas enviadas ni cierres.

No prometer ahorros, ventas, certificaciones, servicios gratuitos, urgencia ficticia, reembolsos, soporte ilimitado ni disponibilidad ininterrumpida. Las respuestas comerciales son texto informativo versionado, nunca recibos de ejecución.

## Comparación investigada

Relevance AI permite construir agentes, ofrece plantillas y herramientas y también ofrece implementación y socios. Por tanto, «ellos solo dan software» y «solo Boltech implementa» serían afirmaciones incorrectas. Tampoco se puede afirmar que Boltech tiene menor costo total sin comparar alcances y consumo.

Fuentes primarias consultadas el 10 noviembre 2026:
- https://relevanceai.com/docs/get-started/introduction
- https://relevanceai.com/agents
- https://partners.relevanceai.com/

La comparación pública se centra en necesidad del comprador, alcance, costo completo, aceptación y soporte; no fija tarifas de rivales que pueden cambiar.

## Verificación y publicación

Pruebas locales: `node --test tests/test_boltech_positioning.mjs`. Verifican ES/EN, objeción, CTA, límites de claims, entrada malformada, respuesta sin proveedor, conservación de payload de pagos, rutas estáticas y consistencia del paquete. No son métricas comerciales reales.

Empaquetado: `python3 scripts/package_boltech_marketing.py`. Incluye únicamente Worker, tres páginas y `_routes.json`. El Worker mantiene el backend previo `e912df66.boltech-group.pages.dev` y los adaptadores Freelancer, Explee, Upwork y audio del paquete de origen. No se añaden cron jobs, proveedores ni suscripciones.

Bloqueos observados en esta sesión: control del navegador local devuelve HTTP 401; no se pudo publicar ni inspeccionar Cloudflare. El navegador de pruebas del contenedor no arrancó por restricciones de sockets; no se declara QA visual ni E2E productivo. GitHub y carga directa son despliegues distintos: una PR no prueba publicación de Pages.

Tras publicar se debe verificar en la URL canónica: página nueva, CTA a Leo, cambio ES/EN, respuesta a «¿Por qué Boltech?» y cabecera `X-Boltech-Commercial-Version: boltech-outcome-20261110-v1`. Verificar regresiones de voz e integraciones. No declarar producción antes de esas comprobaciones.

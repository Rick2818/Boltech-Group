# Auditoría comercial y posventa de Leo — 12 noviembre 2026

**Ámbito:** GitHub `Rick2818/Boltech-Group` en `main`, proyecto Supabase `Boltech Group` (`uxwfqhromoicrwzyylbn`), documentación del gateway Cloudflare Pages `boltech-group`. Sin modificar Wompi, credenciales ni cron.

## Evidencia confirmada

- `main` al inicio de la auditoría: `5e1ea5f3ded89ecb74524f3eb5529190bc88badf`; los PR #368 y #369 están fusionados.
- Cloudflare Pages en GitHub construye una release reducida con cinco archivos y usa el backend conservado `e912df66.boltech-group.pages.dev`. El gateway reenvía el chat `/api?leo_sales=1` al backend previo salvo el saludo especial. El source de ese backend no forma parte de esta release. No se acredita que las skills nuevas del repo estén conectadas al backend publicado.
- Solicitud pública con consentimiento: `POST /api/leo-public-intake` registra un expediente `NEW_UNVERIFIED` en Cloudflare COMMERCE y devuelve referencia. No realiza verificación de identidad ni envío.
- El motor `/api/leo-commerce` exige sesión de propietario para registrar calificación, propuesta, aprobación, seguimiento y cierre; no realiza envíos, pagos ni verificación autónoma de aceptación.
- `/customer-setup` permite enlace privado, captura de catálogo/FAQ, revisión y aceptación de conocimiento con reglas deterministas. No provisiona agente IA, canal WhatsApp real ni entrega.
- La simulación de Pdro Imports usa respuestas sintéticas, no Meta/WhatsApp ni pagos reales. El manual está publicado en los assets de release, pero no sustituye una aceptación contractual real.
- Supabase `Boltech Group` figura `ACTIVE_HEALTHY`. Consultado `cron.job`: ocho jobs, **todos `active=false`**. `list_edge_functions`: lista vacía. Consultas agregadas (sin datos privados) muestran `crm_leads=0`, `crm_followups=0`, `crm_orders=0`, `factory_agent_orders=0`. Esas tablas tienen RLS habilitado. El COMMERCE de Cloudflare no se refleja necesariamente en estas tablas.
- `lib/leo_sales_runtime.js` conserva una selección de herramientas únicamente de lectura y respuestas `qualified:false`; no es demostración de calificación, aprobación y cierre automáticos. Archivos referidos por PRs previos de guías de conversión/mercadeo no se encuentran en `main` actual.
- Upwork: autorización OAuth/MCP independiente de Leo pendiente; Explee: permiso de búsqueda no acreditado; Freelancer: consultas solo lectura. Ninguno autoriza por sí solo publicar propuestas, bids, enviar mensajes o gastar créditos.
- Una vista de Cloudflare obtenida desde una pestaña abierta previamente mostraba #366 como release. **La vista era anterior a los merges #368/#369 y no puede utilizarse para describir el estado actual de producción**. Los intentos de verificación HTTP directa en esta sesión no dieron una prueba reproducible del deployment vigente.

## Matriz de aceptación por componente

| Componente | Código / pruebas | Producción certificada |
|---|---|---|
| Leo UI + chat web | Presente; backend legado por gateway | No comprobada en esta auditoría |
| Captura de lead opt-in | Implementada en #369 | Sin smoke actual confirmado |
| Expedientes y aprobaciones | Implementados en #368 | Sin ejecución auténtica certificada |
| Skills ventas/closer | Guía consultiva y lectura | Ejecución transaccional no acreditada |
| Skills mercadeo | Historial de PRs y borradores | Integración vigente no acreditada |
| Skills servicio al cliente | Sandbox y políticas | Servicio posventa real no acreditado |
| Seguimientos de salida 24/7 | Borradores/notas internas | No; falta canal y ejecutor autorizado |
| Upwork/Explee/Freelancer | Comprobaciones de lectura | Salida no habilitada |
| CRM Supabase | Tablas con RLS | Sin registros de flujo comercial nuevo |
| Configuración catálogo/FAQ | Handler y pruebas | Despliegue y aceptación del cliente pendiente de verificar |
| Provisionamiento IA del cliente | Sandbox sintético | No |
| WhatsApp de cliente real | Pruebas locales sin proveedor | No |
| Wompi | Gateway existente preservado en código | No se ejecutó transacción ni prueba de liquidación |
| Manual de usuario | Fuente y assets de release | Entrega real no acreditada |

## Bloqueadores para el «todo en producción»

1. Obtener el resultado **del workflow de publicación en `main`** para el commit vigente, incluida verificación de HTML hashes, almacenamiento, `GET /api/leo-public-intake` con respuesta 405 y `/api/leo-commerce` con 401 sin autenticación. No sustituir ese paso con CI de PR ni una pestaña antigua.
2. Verificar la ruta real del chat, el historial, latencia y audio desde navegador móvil. Corregir timeout / persistencia sin duplicar requests.
3. Definir una cadena única de escritura entre chat de Leo, expediente comercial y CRM; evitar doble registro y definir exclusión mutua mediante almacén transaccional para operaciones concurrentes.
4. Instalar o integrar los skills vigentes de ventas, closer, mercadeo y servicio al cliente al **backend realmente desplegado**, con pruebas que invoquen el executor y validen recibos (no solo documentación).
5. Para cada canal externo: verificar OAuth, permisos de acción, opt-in del comprador y política del proveedor; idempotencia, bajas, límites y comprobantes de envío. No activar cold email ni canales previamente retirados.
6. Probar pedido real supervisado: identidad del comprador, aceptación de propuesta, comprobante de pago, ficha de conocimiento, conexión real del canal, respuestas, derivación humana y aceptación de entrega. **No usar Pdro ficticio como cliente real.**
7. Diseñar ejecutor continuo propio de Leo si se requiere trabajo proactivo, sin reactivar los ocho cron deshabilitados ni crear un segundo cron no autorizado. Garantizar monitorización y recuperación.

## Política del cierre
No cambiar `CLOSED_WON_REPORTED` por `PAID` o `DELIVERED` sin recibos autenticados del proveedor correspondiente. Ningún resultado sintético constituye venta o pago. No activar external outreach ni despliegues ajenos al proyecto vigente.

**Conclusión:** el código contiene componentes útiles para venta supervisada y ficha posventa, pero no hay base para certificar autonomía integral ni postventa operativa. Permanecen bloqueadores importantes y se requiere evidencia viva del despliegue.

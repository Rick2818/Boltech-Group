# Auditoría Técnica Boltech Group — Producción y Pasarelas de Pago

Fecha: 2026-09-28
Producción auditada: https://boltech-group.vercel.app/
Repositorio: Rick2818/Boltech-Group
Estado: AUDITORÍA SOLAMENTE — NO SE IMPLEMENTARON CORRECCIONES DE PAGO EN ESTA FASE

## Resumen ejecutivo

La aplicación principal responde en producción y varios servicios base están activos, pero el flujo de cobro no está listo para aceptar pagos reales de forma automatizada.

Hallazgo principal: la interfaz presenta Strike y Wompi como rieles activos, pero los endpoints de pago que el front-end necesita no están desplegados en las rutas que el navegador utiliza. Además, el código heredado contiene confirmaciones sintéticas o simuladas que pueden producir falsos positivos de “pago confirmado”.

Hasta corregir los puntos P0 descritos abajo, Boltech no debe activar automáticamente licencias, servicios ni entregables a partir del flujo actual de pago.

## 1. Verificación directa de producción

Resultados HTTP observados:

- / → 200 OK
- /.well-known/agent-card.json → 200 OK
- /api/partners?action=health → 200 OK
- /api/scan → 405 GET, esperado porque acepta POST
- /api/lead → 405 GET, esperado porque acepta POST
- /api/a2a → 405 GET, esperado porque acepta POST
- /api/strike/invoice → 404
- /api/wompi/checkout → 404
- /api/verify-lightning → 404
- /api/webhooks/wompi → 404
- /api/webhooks/strike → 404
- /partners → 404
- /partner_dashboard → 200

Vercel no reportó runtime errors en las 24 horas revisadas, pero esto no demuestra funcionalidad de pago porque varias rutas de pago no existen públicamente en su ubicación esperada.

## 2. Hallazgos P0 — Críticos

### P0-1 — El checkout Wompi visible no ejecuta un checkout Wompi real

El formulario público de Wompi solicita email, método y titular/referencia. Luego envía esa información a POST /api/verify-lightning.

No llama a /EnlacePago de Wompi ni redirige al checkout oficial de Wompi.

Además, el front-end no valida resp.ok antes de mostrar “Activación Confirmada”. Un HTTP 404 puede resolverse normalmente en fetch() y el código actual puede continuar mostrando éxito.

Impacto: el usuario puede creer que pagó o que el pago fue conciliado cuando Wompi nunca procesó una transacción.

Severidad: CRÍTICA.

### P0-2 — El flujo Strike no verifica realmente un pago antes de activar

La interfaz:
1. copia la Lightning Address rick2818@strike.me;
2. pide al comprador que presione “Ya transferí”;
3. genera localmente un ID tipo BOL-MANUAL;
4. intenta llamar /api/verify-lightning.

Ese endpoint devuelve 404 en producción.

Además, el handler heredado de /api/verify-lightning en api/index.js, si alguna vez se enruta, marca cualquier payload como ok:true y status:SETTLED sin consultar a Strike.

Impacto: falso positivo de liquidación.

Severidad: CRÍTICA.

### P0-3 — Los endpoints de pago están en api/index.js pero no publicados en las rutas usadas por producción

El proyecto contiene lógica para:
- /api/strike/invoice
- /api/wompi/checkout
- /api/verify-lightning
- /api/webhooks/wompi
- /api/webhooks/strike

pero Vercel no los está resolviendo a api/index.js.

Resultado real observado: 404.

Impacto: checkout y webhooks no pueden completar el ciclo de pago.

Severidad: CRÍTICA FUNCIONAL.

### P0-4 — Integración Wompi SV no coincide con la documentación oficial

Autenticación:
el código actual intenta enviar API Secret directamente como Bearer y X-App-Id.

La integración oficial Wompi El Salvador obtiene primero un token OAuth mediante:
https://id.wompi.sv/connect/token

con:
- grant_type=client_credentials
- client_id=App ID
- client_secret=API Secret
- audience=wompi_api

Luego utiliza el access_token como Bearer para api.wompi.sv.

Crear Enlace Pago:
Wompi documenta POST https://api.wompi.sv/EnlacePago con estructura:
- identificadorEnlaceComercio
- monto
- nombreProducto
- formaPago
- configuracion

El código Boltech coloca varios campos en ubicaciones o nombres distintos.

Webhook:
Wompi SV documenta el header wompi_hash.

Boltech espera actualmente x-event-checksum.

El payload oficial utiliza propiedades como IdTransaccion, Monto, ResultadoTransaccion, EsProductiva y EnlacePago, mientras código heredado espera una estructura data.transaction que no corresponde al webhook oficial de Wompi El Salvador.

Impacto: autenticación, creación de checkout y conciliación webhook pueden fallar aun con credenciales correctas.

Fuentes:
- https://docs.wompi.sv/
- https://docs.wompi.sv/metodos-api/enlace-de-pago
- https://docs.wompi.sv/webhook/definicion-webhook
- https://docs.wompi.sv/webhook/validar-webhook
- https://github.com/wompisv/wocommerce-wompi-sv-plugin

### P0-5 — Strike invoice y webhook no siguen completamente el modelo oficial

Strike documenta:
1. crear invoice;
2. generar quote mediante /v1/invoices/{invoiceId}/quote;
3. usar lnInvoice devuelto por el quote;
4. después del webhook, consultar nuevamente el recurso para confirmar estado.

El código principal StrikeLightningGateway intenta tomar lnInvoice directamente de la respuesta de creación de invoice.

También espera X-Strike-Signature, mientras Strike documenta actualmente X-Webhook-Signature.

Strike especifica además que el webhook notifica un evento y que se debe consultar el recurso para obtener el estado real. El código heredado intenta interpretar el webhook como si ya contuviera los detalles finales de la invoice.

Impacto: creación Lightning y confirmación webhook no son confiables.

Fuentes:
- https://docs.strike.me/walkthrough/receiving-payments/
- https://docs.strike.me/webhooks/setting-up-webhooks/
- https://docs.strike.me/webhooks/signature-verification/
- https://docs.strike.me/api/find-invoice-by-id/

## 3. Hallazgos P1 — Altos

### P1-1 — Existen simulaciones de pagos que devuelven PAID o APPROVED

mcp/boltech-payments-mcp.mjs contiene modos que, sin credenciales reales:
- crean invoices Strike sintéticas;
- devuelven PAID;
- crean links Wompi simulados;
- devuelven APPROVED.

Los tests actuales incluso esperan esos resultados.

Esto contradice la Regla de Oro de Boltech: CERO SIMULACIÓN presentada como producción.

Los sandboxes pueden existir, pero deben estar totalmente separados de producción, llevar estado TEST/SANDBOX y nunca alimentar revenue, fulfillment, licencias ni reportes reales.

### P1-2 — billing_settlement_sentinel.js permite liquidar Lightning sin API key

La función heredada establece verified=true cuando no existe STRIKE_API_KEY.

Eso es incompatible con producción.

### P1-3 — Servicios públicos sin autenticación suficiente

Actualmente están desplegados públicamente:
- /api/ai
- /api/crm
- /api/whatsapp

Las credenciales de proveedores aparecen actualmente como no configuradas, por lo que el riesgo monetario inmediato es bajo.

Sin embargo, el código POST no exige autorización propia de Boltech. Cuando se configuren claves reales:
- /api/ai podría consumir créditos;
- /api/crm podría insertar o sincronizar datos;
- /api/whatsapp podría intentar despachar mensajes.

CORS no sustituye autenticación server-side.

## 4. Hallazgos P2 — Funcionalidad y credibilidad

### P2-1 — /partners y /partner-network no funcionan

El dashboard existe en /partner_dashboard, pero las rutas amigables configuradas devuelven 404.

### P2-2 — Mensajes comerciales demasiado fuertes para el estado técnico actual

La página utiliza afirmaciones como:
- “Rieles de Cobro Activos”
- “Vigilando transacción en tiempo real”
- “Checkout Custodiado”
- “emisión automática”
- “SOC-2 Type II Compliant”
- “0% Fee Lightning”
- tiempos y ROI específicos.

Antes de mantener esos claims deben existir evidencia técnica, comercial o contractual.

## 5. Estado de otros componentes

Operativos públicamente:
- Homepage
- Agent Card A2A
- Partner health
- scan route
- lead route
- A2A route

No configurados según producción:
- Vercel AI SDK providers
- HubSpot
- Salesforce
- Twilio WhatsApp

Validación de gobernanza:
el workflow Boltech Governance Validation más reciente terminó exitosamente después de corregir el correo institucional antiguo. Sin embargo, esa suite todavía no bloquea los modos sintéticos del subsistema de pagos.

## 6. Plan propuesto — NO IMPLEMENTADO TODAVÍA

### Fase 0 — Contención

Antes de cobrar a un cliente real:
1. Desactivar el mensaje de “pago confirmado” en Wompi.
2. No activar servicios a partir del botón “Ya transferí” de Strike.
3. Mantener cualquier pago manual bajo revisión humana hasta completar la integración.
4. Separar totalmente sandbox de producción.

### Fase 1 — Arquitectura de órdenes

Crear un Order/Payment Ledger con estados:
- CREATED
- PENDING_PAYMENT
- PROVIDER_PENDING
- PAID
- FAILED
- EXPIRED
- REFUNDED

Campos mínimos:
- orderId
- provider
- providerInvoiceId o transactionId
- plan
- expectedAmount
- currency
- customerEmail
- createdAt
- paidAt
- providerEvidence
- fulfillmentStatus

El browser nunca podrá cambiar directamente una orden a PAID.

### Fase 2 — Strike real

Crear funciones Vercel dedicadas:
- POST /api/payments/strike/create
- GET /api/payments/strike/status
- POST /api/webhooks/strike

Flujo:
Order CREATED → Strike Invoice → Strike Quote → BOLT11 → cliente paga → webhook firmado → servidor consulta invoice en Strike → state=PAID y monto correcto → ledger PAID → fulfillment.

Sin STRIKE_API_KEY: fail closed.

### Fase 3 — Wompi El Salvador real

Crear funciones dedicadas:
- POST /api/payments/wompi/create
- GET /api/payments/wompi/status
- POST /api/webhooks/wompi

Flujo:
Order CREATED → OAuth client_credentials Wompi SV → POST /EnlacePago → redirect oficial Wompi → Wompi procesa pago → webhook wompi_hash → validar HMAC con body RAW → validar monto, referencia y productivo → opcionalmente consultar /TransaccionCompra/{id} → ledger PAID → fulfillment.

### Fase 4 — Front-end

El front no confirma pagos. Solo puede mostrar:
- Esperando pago
- Verificando con proveedor
- Pago confirmado por proveedor
- Pago no confirmado

El botón Wompi debe abrir el URL real generado por Wompi.

Strike debe mostrar el BOLT11 real generado por el servidor.

### Fase 5 — Pruebas

Wompi:
- pago sandbox aprobado;
- pago sandbox rechazado;
- webhook con hash incorrecto;
- monto alterado;
- duplicate webhook;
- redirect manipulado.

Strike:
- invoice UNPAID;
- invoice PAID;
- invoice vencida;
- webhook con firma incorrecta;
- evento duplicado;
- monto esperado vs monto recibido.

Seguridad:
- ninguna ruta de pago cambia PAID sin provider evidence;
- ninguna clave aparece en Git, log o browser;
- idempotencia distribuida;
- rate limits;
- autenticación en acciones administrativas.

### Fase 6 — Smoke test de producción

Con aprobación de Dirección General:
1. transacción Wompi real de monto mínimo permitido;
2. transacción Strike real controlada;
3. verificar depósito;
4. verificar ledger;
5. verificar correo;
6. verificar que un replay no duplica fulfillment.

Solo después se habilita el checkout para clientes.

## 7. Criterios para declarar “100% funcional”

Boltech puede declarar el sistema de pagos funcional cuando:
- las rutas públicas existen y responden;
- Wompi genera checkout real;
- Strike genera BOLT11 real;
- ningún pago se confirma desde información proporcionada solo por el navegador;
- webhooks oficiales son validados;
- el backend reconcilia proveedor, monto y referencia;
- sandbox jamás entra a métricas reales;
- duplicate webhooks no duplican entrega;
- fulfillment ocurre una sola vez;
- pruebas de éxito, rechazo y fraude pasan;
- los claims públicos coinciden con la realidad técnica.

## Conclusión

Estado actual del checkout: NO APTO PARA AUTOMATIZAR COBROS REALES.

La aplicación general está en línea, pero los rieles de pago requieren una corrección arquitectónica antes de usarlos con clientes.

No se ha implementado ninguna de estas correcciones todavía.
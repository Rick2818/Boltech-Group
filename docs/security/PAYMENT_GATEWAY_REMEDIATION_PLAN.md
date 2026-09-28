# Boltech Group — Plan de Remediación y Seguridad de Pasarelas de Pago

**Versión:** 1.0
**Fecha:** 2026-09-28
**Estado:** PROPUESTO — REQUIERE APROBACIÓN ANTES DE IMPLEMENTAR
**Alcance:** Producción `https://boltech-group.vercel.app/`, Strike, Wompi El Salvador, rutas de pago, webhooks, fulfillment y auditoría.

---

## 1. Objetivo

Reconstruir el núcleo de pagos de Boltech Group para que ningún navegador, usuario, agente, test, mock o proceso interno pueda declarar una transacción como pagada sin evidencia verificable del proveedor.

Principio rector:

> **El proveedor de pago confirma; Boltech verifica; el ledger registra; recién entonces se entrega el servicio.**

No se aceptan fallbacks que conviertan errores, falta de credenciales o simulaciones en estados `PAID`, `APPROVED` o `SETTLED`.

---

# 2. Estado actual y criterio de contención

Hasta completar las fases P0:

- No activar automáticamente productos o licencias desde Wompi.
- No activar automáticamente productos o licencias desde el botón “Ya transferí” de Lightning.
- No contabilizar como venta ningún evento generado solo por front-end.
- No utilizar resultados de sandbox en métricas comerciales.
- Mantener cobros manuales bajo verificación humana si fuese indispensable operar durante la remediación.

---

# 3. Arquitectura objetivo

```
Browser
   |
   | crea orden
   v
Boltech Payment API
   |
   +--> Order Ledger: CREATED
   |
   +--> Wompi SV / Strike API
             |
             v
       Proveedor procesa
             |
             v
      Webhook firmado
             |
             v
Boltech verifica firma + consulta proveedor
             |
             v
Monto + moneda + orderId + estado correctos
             |
             v
Order Ledger: PAID
             |
             v
Fulfillment idempotente
             |
             v
Correo / acceso / commission ledger
```

El front-end nunca escribe `PAID`.

---

# 4. FASE P0 — Correcciones críticas

## P0.1 — Crear un Payment / Order Ledger real

Crear almacenamiento persistente server-side.

Estados:

- CREATED
- PENDING_PAYMENT
- PROVIDER_PENDING
- PAID
- FAILED
- EXPIRED
- REFUNDED
- CANCELED

Campos mínimos:

- orderId UUID
- provider
- providerTransactionId / providerInvoiceId
- productId
- expectedAmount
- currency
- customerEmail
- environment: production | sandbox
- status
- createdAt
- expiresAt
- paidAt
- providerEvidence
- webhookEventId
- fulfillmentStatus
- fulfillmentAt
- version / optimistic-lock field

Reglas:

- `expectedAmount` y producto se calculan en servidor.
- Nunca aceptar monto final enviado por browser como fuente de verdad.
- `orderId` debe ser único.
- provider transaction IDs deben tener restricción única.
- una orden solo puede pasar a PAID una vez.

---

## P0.2 — Rehacer Wompi El Salvador según documentación oficial

### Endpoint Boltech

`POST /api/payments/wompi/create`

Responsabilidades:

1. validar producto y email;
2. obtener precio únicamente desde catálogo server-side;
3. crear orderId;
4. guardar CREATED;
5. obtener token Wompi mediante OAuth client_credentials;
6. crear EnlacePago oficial;
7. guardar `idEnlace` y URL;
8. devolver únicamente el checkout URL oficial al browser.

### Integración oficial

Token:
`https://id.wompi.sv/connect/token`

Parámetros:
- grant_type=client_credentials
- client_id=WOMPI_APP_ID
- client_secret=WOMPI_API_SECRET
- audience=wompi_api

Enlace:
`POST https://api.wompi.sv/EnlacePago`

Campos Boltech:
- identificadorEnlaceComercio = orderId
- monto = expectedAmount
- nombreProducto
- formaPago
- configuracion.urlWebhook
- configuracion.urlRedirect
- configuracion.esMontoEditable = false
- configuracion.esCantidadEditable = false
- límites de uso: 1 pago exitoso cuando aplique

El cliente debe ser redirigido al `urlEnlace` generado por Wompi.

Boltech nunca captura número de tarjeta, CVV ni fecha de expiración.

---

## P0.3 — Webhook Wompi seguro

Endpoint:

`POST /api/webhooks/wompi`

Controles obligatorios:

1. leer body RAW exacto;
2. obtener header `wompi_hash`;
3. calcular HMAC-SHA256 con API Secret;
4. comparar mediante función timing-safe;
5. rechazar firma inválida;
6. extraer IdTransaccion y orderId;
7. consultar `/TransaccionCompra/{id}` a Wompi;
8. verificar:
   - transacción existe;
   - aprobada;
   - ambiente productivo;
   - monto == expectedAmount;
   - orderId corresponde;
9. efectuar transición atómica a PAID;
10. ignorar replays ya procesados;
11. ejecutar fulfillment una sola vez.

El redirect del navegador NO es prueba de pago.

---

## P0.4 — Rehacer Strike con invoice + quote real

Endpoints:

- `POST /api/payments/strike/create`
- `GET /api/payments/strike/status?orderId=...`
- `POST /api/webhooks/strike`

Flujo:

1. servidor crea orderId;
2. guarda CREATED;
3. crea invoice Strike;
4. recibe invoiceId;
5. genera quote usando invoiceId;
6. obtiene `lnInvoice` real;
7. guarda invoiceId;
8. devuelve BOLT11 / QR al browser;
9. cliente paga;
10. Strike envía webhook;
11. Boltech valida firma;
12. Boltech consulta invoice real a Strike;
13. confirma PAID, monto y moneda;
14. ledger pasa a PAID;
15. fulfillment exactamente una vez.

Sin `STRIKE_API_KEY`:
**503 CONFIGURATION_ERROR**, nunca `PAID`.

---

## P0.5 — Webhook Strike seguro

Usar header:

`X-Webhook-Signature`

Validación:

- HMAC SHA-256;
- secreto específico de webhook;
- comparación timing-safe;
- body canónico/raw según especificación;
- no confiar en el payload para estado final;
- consultar invoice al proveedor después del evento;
- registrar event ID / hash para evitar replay.

---

## P0.6 — Eliminar confirmaciones sintéticas

Eliminar o aislar de producción:

- `sim_strike_...`
- `sim_wompi_...`
- estados sintéticos PAID;
- estados sintéticos APPROVED;
- `verified=true` cuando falte API key;
- registros test en revenue/ventas;
- cualquier mock con apariencia de producción.

Sandbox solo puede producir:

- TEST_PENDING
- TEST_PAID
- TEST_FAILED

y debe almacenarse en un namespace/tabla separada.

---

# 5. FASE P1 — Seguridad de las pasarelas

## P1.1 — Trust boundary

Browser = no confiable.

Nunca confiar en:
- amount
- currency
- product price
- discount
- payment status
- provider transaction ID
- fulfillment flag
- commission amount

Todo se recalcula o verifica server-side.

---

## P1.2 — Idempotencia y race conditions

Controles:

- unique(orderId)
- unique(providerTransactionId)
- unique(webhookEventId)
- transición condicional:
  `UPDATE ... WHERE status != 'PAID'`
- fulfillment protegido con unique(orderId, fulfillmentType)
- idempotency key para llamadas externas no idempotentes
- transacción atómica al marcar PAID + crear fulfillment

Objetivo:

100 webhooks repetidos = 1 pago + 1 entrega.

---

## P1.3 — Replay protection

Cada webhook debe registrar:

- provider
- event fingerprint
- receivedAt
- signatureValid
- processed
- processingResult

Eventos repetidos:
HTTP 200 ACK, sin ejecutar otra vez.

---

## P1.4 — Secrets y credenciales

Variables separadas:

- WOMPI_APP_ID
- WOMPI_API_SECRET
- STRIKE_API_KEY
- STRIKE_WEBHOOK_SECRET

Reglas:

- Vercel encrypted environment variables;
- jamás en Git;
- jamás en HTML;
- jamás en respuesta API;
- jamás completas en logs;
- rotación después de la migración;
- claves distintas sandbox/production;
- menor privilegio posible.

---

## P1.5 — Egress allowlist

Las funciones de pago solo podrán llamar hosts autorizados:

Wompi:
- id.wompi.sv
- api.wompi.sv

Strike:
- api.strike.me

Nunca aceptar una URL de proveedor enviada por el browser.

Esto reduce SSRF y redirecciones maliciosas.

---

## P1.6 — Validación estricta de inputs

Schema server-side:

- productId enum
- email RFC razonable
- orderId UUID
- provider enum
- longitud máxima en todos los strings
- currency fija por flujo
- rechazo de campos inesperados en endpoints sensibles

No usar type coercion silenciosa.

---

## P1.7 — Rate limiting

Límites independientes para:

- create order;
- payment status;
- webhook;
- support;
- AI;
- WhatsApp;
- CRM.

Webhooks:
rate limit suficiente para proveedor pero con anomaly detection.

Create order:
IP + fingerprint/sesión + email.

Objetivo:
evitar abuso, spam, consumo de APIs y creación masiva de invoices.

---

## P1.8 — CSRF y CORS

Para endpoints ligados a sesión:
- SameSite cookies;
- CSRF token;
- Origin/Referer validation.

Para APIs públicas de creación de pago:
- CORS restringido a dominios Boltech;
- rate limit;
- no confiar en CORS como autenticación.

Webhooks:
no CSRF; autenticación por firma criptográfica.

---

## P1.9 — Headers y navegador

Mantener:
- HSTS
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame-ancestors

Endurecer CSP:
- eliminar gradualmente `unsafe-inline`;
- nonces/hashes para scripts;
- connect-src solo a destinos realmente usados;
- eliminar api.stripe.com si Stripe ya no se utiliza;
- revisar terceros del QR.

---

## P1.10 — Logging seguro

Registrar:
- orderId
- provider
- provider transaction ID
- estado
- firma válida sí/no
- monto esperado/confirmado
- timestamp
- event fingerprint

No registrar:
- API secrets
- bearer tokens
- CVV
- tarjeta
- BOLT11 completo si no es necesario
- PII adicional innecesaria

Logs de seguridad separados de logs comerciales.

---

# 6. FASE P1 — Seguridad del fulfillment

El dinero y la entrega son transacciones diferentes.

Estados:

- NOT_READY
- READY
- PROCESSING
- COMPLETED
- FAILED

Solo una orden PAID puede pasar a READY.

El fulfillment debe ser idempotente.

Si email falla después de PAID:
- la orden sigue PAID;
- fulfillment = FAILED;
- reintentar entrega;
- nunca volver a cobrar.

---

# 7. FASE P1 — Protección de comisión y revenue

Solo registrar revenue cuando:

- order.status = PAID;
- ambiente = production;
- provider verification = true.

Commission Ledger:
solo recibe efectivo confirmado.

Sandbox:
nunca alimenta:
- ventas;
- revenue;
- comisiones;
- KPI;
- reportes comerciales.

---

# 8. FASE P2 — Front-end seguro y honesto

Eliminar frases no verificables.

Estados visibles permitidos:

- Preparando checkout
- Esperando pago
- Verificando con Wompi/Strike
- Pago confirmado por proveedor
- Pago rechazado
- Pago expirado

Nunca mostrar:
- “pagado” después de click del usuario;
- “liquidado” basándose en redirect;
- “activado” antes del ledger PAID.

Wompi:
botón abre checkout hospedado oficial.

Strike:
mostrar QR generado a partir del BOLT11 real.

---

# 9. FASE P2 — Claims y confianza

Revisar toda la web y retirar o demostrar:

- SOC 2 Type II;
- uptime específico;
- ROI específico;
- “0% comisión” si no es universalmente cierto;
- “24/7 monitoring” si no hay monitor real;
- “instant activation” si existe proceso manual;
- tiempos de respuesta no medidos.

Regla:
**no vender una capacidad que producción no pueda demostrar hoy.**

---

# 10. Pruebas obligatorias antes de liberar

## Wompi

- crear link válido;
- link contiene order correcto;
- monto no editable;
- pago aprobado;
- pago rechazado;
- firma correcta;
- firma incorrecta;
- monto alterado;
- orderId alterado;
- transacción inexistente;
- webhook duplicado x100;
- redirect manipulado;
- sandbox no entra a production ledger.

## Strike

- invoice creada;
- quote generado;
- BOLT11 real;
- unpaid;
- paid;
- expired;
- webhook válido;
- webhook inválido;
- webhook replay x100;
- invoice/monto no coincide;
- API timeout;
- sin API key = fail closed.

## Business logic

- browser intenta cambiar $69 a $0.01;
- browser envía status PAID;
- browser cambia productId;
- dos webhooks simultáneos;
- dos requests de fulfillment simultáneos;
- webhook de orden ya reembolsada;
- pago correcto pero email falla.

Todos deben producir resultado seguro.

---

# 11. Security gate de CI/CD

Agregar workflow obligatorio:

`Boltech Payment Security Validation`

Debe bloquear deploy si detecta:

- `sim_strike_`
- `sim_wompi_`
- `mock_bolt11`
- `verified = true` por falta de API key
- `status: 'PAID'` en mocks productivos
- secretos hardcoded
- endpoint de pago sin schema validation
- webhook sin verificación de firma
- uso de monto proveniente directamente del browser
- fulfillment antes de provider verification

Tests unitarios + integración obligatorios antes de merge.

---

# 12. Observabilidad y alertas

Alertar por:

- 5+ firmas inválidas en 10 min;
- mismatch de monto;
- mismo provider transaction ID en dos orders;
- replay anormal;
- aumento de failed payments;
- API provider indisponible;
- fulfillment repetido;
- order PAID sin providerEvidence.

Reporte diario:
- pagos intentados;
- pagos confirmados;
- fallidos;
- reembolsos;
- mismatch;
- webhooks inválidos;
- ningún dato sintético.

---

# 13. Rollback

Antes del cambio:

- tag Git estable;
- backup del ledger/schema;
- snapshot de variables de configuración, sin exportar secretos;
- mantener checkout antiguo deshabilitado, no borrado, hasta smoke test.

Si falla production smoke test:

1. deshabilitar endpoints nuevos;
2. volver a modo “contactar para pagar”;
3. no restaurar lógica sintética;
4. conservar evidencia del fallo;
5. corregir y volver a probar.

---

# 14. Orden de implementación

### Bloque A — 1
- Payment Ledger
- catálogo server-side
- state machine
- tests de negocio

### Bloque B — 2
- Wompi OAuth
- Wompi EnlacePago
- Wompi webhook
- reconciliación

### Bloque C — 3
- Strike invoice
- Strike quote
- Strike webhook
- reconciliación

### Bloque D — 4
- frontend
- eliminar falsas confirmaciones
- estados honestos

### Bloque E — 5
- CI security gate
- rate limiting
- auth endpoints auxiliares
- CSP y secrets audit

### Bloque F — 6
- sandbox tests
- adversarial tests
- production smoke test controlado

---

# 15. Gate de aprobación para producción

No se habilita checkout hasta que todos sean SI:

- [ ] Wompi link real creado
- [ ] Wompi webhook HMAC validado
- [ ] Wompi transaction re-check validado
- [ ] Strike invoice real creada
- [ ] Strike quote real generado
- [ ] Strike webhook HMAC validado
- [ ] Strike invoice re-check validado
- [ ] monto/currency/orderId verificados server-side
- [ ] idempotencia probada
- [ ] replay probado
- [ ] sandbox aislado
- [ ] secretos fuera de Git
- [ ] fulfillment exactly-once
- [ ] audit log
- [ ] security workflow verde
- [ ] claims públicos revisados
- [ ] smoke test controlado aprobado por Dirección General

---

# 16. Resultado esperado

Al terminar:

- ningún usuario puede auto-confirmar un pago;
- ningún mock puede generar revenue;
- ningún webhook falsificado puede activar un servicio;
- ningún replay puede duplicar entrega;
- ninguna alteración de monto desde browser funciona;
- Wompi y Strike son la única fuente de evidencia externa;
- Boltech conserva trazabilidad completa desde order → payment → fulfillment → commission;
- el checkout puede ser presentado a clientes sin depender de afirmaciones técnicas falsas.

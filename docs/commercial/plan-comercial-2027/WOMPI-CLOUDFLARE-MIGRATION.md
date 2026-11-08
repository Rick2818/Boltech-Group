# Migracion Wompi SV a Cloudflare Pages

El flujo original de Vercel fue exportado a `functions/api/payments.js`.
La implementacion de Vercel no fue modificada.

## Rutas

```text
GET  /api/payments?action=readiness
POST /api/payments?action=create-approved
POST /api/payments?action=wompi-webhook
GET  /api/payments?action=wompi-return&...
GET  /api/payments?action=status&orderId=...
GET  /commerce-admin.html
```

## Preservado

- OAuth oficial de Wompi SV.
- Creacion de `EnlacePago` con importe y cantidad no editables.
- `PAYMENT_ENV` y comprobacion del entorno productivo.
- Firma HMAC `wompi_hash` con `WOMPI_API_SECRET`.
- Comprobacion independiente de `TransaccionCompra` antes de marcar `PAID`.
- Validacion de importe, enlace, transaccion, resultado y entorno.
- Idempotencia: una orden `PAID` no vuelve a procesarse.
- Ledger de eventos firmado en `event:wompi:<sha256>` con retención de 90 días.
- KV dedicado `COMMERCE`; no se usa la tabla de leads.
- Sin datos de tarjeta en Boltech.
- Provisionamiento mínimo posterior a pago: tenant activo, límites y estado de integraciones.

## Estado de credenciales

Los valores de `WOMPI_APP_ID` y `WOMPI_API_SECRET` fueron copiados desde Vercel sin imprimirlos. `PAYMENT_ENV=production` quedo configurado.

La comprobacion externa de solo lectura devolvio `HTTP 400 invalid_client` en Wompi. No se creo ningun enlace ni se realizo ningun cobro. Las credenciales deben actualizarse con valores validos antes de activar checkout.

Falta deliberadamente un secreto independiente para emitir cotizaciones aprobadas:

```text
COMMERCE_ADMIN_TOKEN=<crear y cargar manualmente>
```

No se reutiliza `PARTNER_API_TOKEN`, `BOLTECH_MCP_API_KEY` ni otro token de terceros.

## Almacenamiento

KV de produccion:

```text
binding: COMMERCE
id: 92142dba891b4c0aac9edf370c85a808
```

## Regla de activacion

Un webhook firmado y verificado deja la orden y el tenant en:

```text
PAID / TENANT_ACTIVE_INTEGRATIONS_PENDING_AUTH
```

El tenant contiene límites operativos y queda activo, pero las integraciones permanecen en `PENDING_CUSTOMER_AUTH`. No se guardan credenciales ni se conecta ningún partner sin autorización explícita.

La pantalla interna `/commerce-admin.html` permite emitir cotizaciones aprobadas y consultar órdenes. El token administrativo se ingresa manualmente, no se guarda en `localStorage` y no se reutilizan tokens de partners.

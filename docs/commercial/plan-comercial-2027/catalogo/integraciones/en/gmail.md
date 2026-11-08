# Gmail

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://developers.google.com/gmail/api
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

Lectura de pedidos y facturas que llegan por correo, sin copiarlos a mano.

## Operations tasks it can serve

- pedidos
- facturas

## Data it would touch

- Remitente, asunto, cuerpo y adjuntos de los mensajes de pedido
- Facturas adjuntas en PDF

## Authentication

OAuth 2.0 con alcances (scopes) concedidos por el usuario; el acceso se revoca desde la cuenta.

## Declared limits and risks

- Leer un buzón implica tratar datos personales de terceros
- Los alcances amplios deben justificarse o rechazarse en la revisión de la app
- Un adjunto escaneado sin texto puede no ser legible sin OCR

## What must be validated before quoting

- Definir el buzón exacto y los alcances mínimos
- Confirmar si la app requiere verificación del proveedor
- Probar con mensajes reales anonimizados

## Limits of this sheet

- No real connection was executed against Gmail.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by Gmail.
- No credentials, no customer data and no spend.

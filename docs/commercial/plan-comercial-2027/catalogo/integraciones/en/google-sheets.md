# Google Sheets

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://developers.google.com/sheets/api
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

Hoja compartida como destino simple de pedidos, conciliación y stock.

## Operations tasks it can serve

- pedidos
- facturas
- stock

## Data it would touch

- Pedidos normalizados
- Tabla de conciliación con diferencias
- Inventario y mínimos

## Authentication

OAuth 2.0 por usuario o cuenta de servicio dentro de un proyecto de Google Cloud.

## Declared limits and risks

- El permiso es por archivo y por cuenta; una cuenta de servicio requiere compartir la hoja explícitamente
- Las cuotas se aplican por proyecto, no por hoja
- Dos procesos escribiendo la misma fila pueden pisarse

## What must be validated before quoting

- Definir el archivo y la cuenta propietaria
- Confirmar la cuota del proyecto
- Probar escritura idempotente por clave de fila

## Limits of this sheet

- No real connection was executed against Google Sheets.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by Google Sheets.
- No credentials, no customer data and no spend.

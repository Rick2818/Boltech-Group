# Airtable

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://airtable.com/developers/web/api/introduction
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

Tabla operativa para pedidos e inventario, con vistas y campos tipados.

## Operations tasks it can serve

- pedidos
- stock

## Data it would touch

- Pedidos: número, cliente, ítems, cantidades, fecha, estado
- Inventario: ítem, mínimo, existencia, proveedor

## Authentication

Token de acceso personal (PAT) o OAuth para integraciones registradas.

## Declared limits and risks

- Un token con alcance amplio puede leer más bases de las necesarias
- Los límites de peticiones se aplican por base y por token
- Los adjuntos y campos calculados tienen tratamiento propio

## What must be validated before quoting

- Crear un token limitado a una sola base
- Confirmar el límite vigente de peticiones por segundo
- Probar escritura concurrente sobre el mismo registro

## Limits of this sheet

- No real connection was executed against Airtable.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by Airtable.
- No credentials, no customer data and no spend.

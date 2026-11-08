# Supabase

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://supabase.com/docs/guides/api
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

Base de datos propia para inventario y registro de pedidos, con permisos por fila.

## Operations tasks it can serve

- pedidos
- stock

## Data it would touch

- Pedidos y su estado
- Inventario, mínimos y consumo
- Registro de cambios

## Authentication

Claves de API del proyecto (anónima y de servicio) y reglas de seguridad por fila (RLS).

## Declared limits and risks

- La clave de servicio omite las reglas por fila: nunca debe usarse en el navegador
- Una política RLS mal escrita expone datos entre organizaciones
- El respaldo y la retención son responsabilidad del proyecto

## What must be validated before quoting

- Definir el modelo de datos y las políticas RLS
- Separar la clave de servicio del cliente
- Probar aislamiento entre dos organizaciones

## Limits of this sheet

- No real connection was executed against Supabase.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by Supabase.
- No credentials, no customer data and no spend.

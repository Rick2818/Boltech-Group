# n8n

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://docs.n8n.io/
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

Orquestador de los tres flujos: dispara, transforma y registra sin servidor propio.

## Operations tasks it can serve

- pedidos
- facturas
- stock

## Data it would touch

- Los datos que pasan por cada nodo
- Credenciales guardadas por nodo
- Historial de ejecuciones

## Authentication

Credenciales por nodo, almacenadas y cifradas por la instancia; webhooks con su propia URL.

## Declared limits and risks

- Autoalojado exige mantenimiento, respaldo y actualizaciones de seguridad
- El historial de ejecuciones puede contener datos personales
- Una instancia expuesta sin autenticación permite ejecutar flujos ajenos

## What must be validated before quoting

- Elegir entre nube y autoalojado
- Definir retención del historial de ejecuciones
- Probar reintentos y ejecuciones duplicadas

## Limits of this sheet

- No real connection was executed against n8n.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by n8n.
- No credentials, no customer data and no spend.

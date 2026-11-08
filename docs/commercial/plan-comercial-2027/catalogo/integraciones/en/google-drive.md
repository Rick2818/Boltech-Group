# Google Drive

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://developers.google.com/drive/api
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

Carpeta de facturas y órdenes de compra como fuente de la conciliación.

## Operations tasks it can serve

- facturas

## Data it would touch

- Facturas PDF
- Órdenes de compra
- Metadatos de archivo (nombre, fecha, carpeta)

## Authentication

OAuth 2.0 por usuario o cuenta de servicio con la carpeta compartida.

## Declared limits and risks

- El acceso es por carpeta; una carpeta mal compartida expone documentos
- Los PDF escaneados requieren OCR y eso no está cubierto por la API de archivos
- Los archivos pueden cambiar de nombre o de carpeta

## What must be validated before quoting

- Acordar la carpeta y el esquema de nombres
- Probar PDF con texto y PDF escaneado
- Confirmar qué pasa cuando falta la orden de compra

## Limits of this sheet

- No real connection was executed against Google Drive.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by Google Drive.
- No credentials, no customer data and no spend.

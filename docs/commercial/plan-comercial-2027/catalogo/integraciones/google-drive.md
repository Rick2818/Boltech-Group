# Google Drive

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://developers.google.com/drive/api
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

Carpeta de facturas y órdenes de compra como fuente de la conciliación.

## Tareas de operaciones que puede servir

- facturas

## Qué datos tocaría

- Facturas PDF
- Órdenes de compra
- Metadatos de archivo (nombre, fecha, carpeta)

## Cómo se autentica

OAuth 2.0 por usuario o cuenta de servicio con la carpeta compartida.

## Límites y riesgos declarados

- El acceso es por carpeta; una carpeta mal compartida expone documentos
- Los PDF escaneados requieren OCR y eso no está cubierto por la API de archivos
- Los archivos pueden cambiar de nombre o de carpeta

## Qué hay que validar antes de cotizar

- Acordar la carpeta y el esquema de nombres
- Probar PDF con texto y PDF escaneado
- Confirmar qué pasa cuando falta la orden de compra

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra Google Drive.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de Google Drive.
- Sin credenciales, sin datos de clientes y sin gasto.

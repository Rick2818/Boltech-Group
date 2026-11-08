# Google Sheets

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://developers.google.com/sheets/api
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

Hoja compartida como destino simple de pedidos, conciliación y stock.

## Tareas de operaciones que puede servir

- pedidos
- facturas
- stock

## Qué datos tocaría

- Pedidos normalizados
- Tabla de conciliación con diferencias
- Inventario y mínimos

## Cómo se autentica

OAuth 2.0 por usuario o cuenta de servicio dentro de un proyecto de Google Cloud.

## Límites y riesgos declarados

- El permiso es por archivo y por cuenta; una cuenta de servicio requiere compartir la hoja explícitamente
- Las cuotas se aplican por proyecto, no por hoja
- Dos procesos escribiendo la misma fila pueden pisarse

## Qué hay que validar antes de cotizar

- Definir el archivo y la cuenta propietaria
- Confirmar la cuota del proyecto
- Probar escritura idempotente por clave de fila

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra Google Sheets.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de Google Sheets.
- Sin credenciales, sin datos de clientes y sin gasto.

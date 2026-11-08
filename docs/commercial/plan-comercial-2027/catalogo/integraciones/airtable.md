# Airtable

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://airtable.com/developers/web/api/introduction
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

Tabla operativa para pedidos e inventario, con vistas y campos tipados.

## Tareas de operaciones que puede servir

- pedidos
- stock

## Qué datos tocaría

- Pedidos: número, cliente, ítems, cantidades, fecha, estado
- Inventario: ítem, mínimo, existencia, proveedor

## Cómo se autentica

Token de acceso personal (PAT) o OAuth para integraciones registradas.

## Límites y riesgos declarados

- Un token con alcance amplio puede leer más bases de las necesarias
- Los límites de peticiones se aplican por base y por token
- Los adjuntos y campos calculados tienen tratamiento propio

## Qué hay que validar antes de cotizar

- Crear un token limitado a una sola base
- Confirmar el límite vigente de peticiones por segundo
- Probar escritura concurrente sobre el mismo registro

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra Airtable.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de Airtable.
- Sin credenciales, sin datos de clientes y sin gasto.

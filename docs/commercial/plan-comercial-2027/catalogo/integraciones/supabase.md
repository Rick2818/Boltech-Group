# Supabase

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://supabase.com/docs/guides/api
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

Base de datos propia para inventario y registro de pedidos, con permisos por fila.

## Tareas de operaciones que puede servir

- pedidos
- stock

## Qué datos tocaría

- Pedidos y su estado
- Inventario, mínimos y consumo
- Registro de cambios

## Cómo se autentica

Claves de API del proyecto (anónima y de servicio) y reglas de seguridad por fila (RLS).

## Límites y riesgos declarados

- La clave de servicio omite las reglas por fila: nunca debe usarse en el navegador
- Una política RLS mal escrita expone datos entre organizaciones
- El respaldo y la retención son responsabilidad del proyecto

## Qué hay que validar antes de cotizar

- Definir el modelo de datos y las políticas RLS
- Separar la clave de servicio del cliente
- Probar aislamiento entre dos organizaciones

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra Supabase.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de Supabase.
- Sin credenciales, sin datos de clientes y sin gasto.

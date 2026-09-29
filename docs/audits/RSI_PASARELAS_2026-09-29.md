# Ciclo RSI de pasarelas — 2026-09-29

## Línea base

- Producción devuelve HTTP 503 con `PAYMENT_ENV_NOT_CONFIGURED` en `/api/payments?action=readiness`.
- El catálogo deriva precios del servidor. Wompi y Strike verifican el recurso del proveedor antes de confirmar `PAID`.
- La suite vigente de seguridad de pagos pasó; cuatro pruebas heredadas esperaban liquidaciones simuladas y se reemplazaron por una prueba de retiro seguro.

## Hipótesis y cambios de esta iteración

| Riesgo observado | Cambio | Prueba de aceptación |
|---|---|---|
| Un webhook rechazado se reconoce como duplicado antes de verificar su firma | Verificar firma antes de consultar la deduplicación y reconocer solo eventos aceptados y firmados | Dos entregas inválidas conservan respuesta de error |
| Una transacción Wompi puede asociarse a otro enlace con el mismo importe | Exigir ID de enlace, ID de transacción y entorno coincidentes con la orden | Una transacción aprobada de otro enlace no marca `PAID` |
| Un evento anterior de Strike puede rebajar una orden ya pagada | Conservar `PAID` y registrar el evento tardío | Prueba de transición pendiente en suite integrada |
| Dos webhooks concurrentes pueden enviar dos correos | Reclamo atómico persistente mediante Redis `SET NX`, sin respaldo en RAM ni reclamo por lectura previa | Solo un trabajador adquiere el reclamo concurrente |

## Límites y siguiente vuelta

El reclamo de notificación es **a lo sumo una vez**, no una garantía de entrega. Si el correo falla después del reclamo, el estado queda `FAILED` y requiere revisión manual; no se reenvía automáticamente para evitar duplicados. Una falla entre reclamo y registro del evento también requiere revisión. La disponibilidad de Upstash se expone en `readiness` como `fulfillment.atomicClaimConfigured`.

Antes de activar pagos reales: configurar `PAYMENT_ENV`, credenciales de ambos proveedores, Airtable y Upstash en Vercel; probar un pago y reembolso controlado en cada sandbox, webhooks repetidos y fuera de orden, y reconciliar orden, evidencia del proveedor y notificación. No se ejecutaron cargos reales en esta iteración.

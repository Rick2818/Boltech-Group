# Facturas contra orden de compra

Estado: APROBADO (2026-11-05) · Oferta sugerida: implementation · Precio: cotización según alcance

## Problema

Las diferencias de precio o cantidad se detectan al pagar, cuando ya es tarde.

## Qué se entrega

- Comparación factura contra orden
- Diferencia marcada con su motivo
- Monto en discusión por documento
- Aprobación o rechazo por finanzas

## Criterio de aceptación

Treinta facturas de prueba con diferencias sembradas detectadas, cada una con motivo y monto, sin diferencias inventadas.

## Qué no prometemos

No prometemos leer facturas sin texto legible; eso se valida antes de cotizar.

## Demo en quince minutos

Se procesan tres facturas con una diferencia conocida y se muestra el monto total en riesgo.

## Integraciones propuestas

- gmail (requiere validación técnica)
- google-drive (requiere validación técnica)
- google-sheets (requiere validación técnica)

---

## Notas internas de revisión

- Pieza aprobada por el propietario el 2026-11-05.
- Sin precio publicado: se cotiza después de revisar alcance.
- No se conecta ninguna integración sin validarla técnicamente.
- El agente no compra, no paga y no envía nada de forma autónoma.
- Texto legal pendiente antes de publicar (ver docs/LEGAL-MINIMO.md).

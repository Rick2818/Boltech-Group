# Stock bajo mínimo con reposición sugerida

Estado: APROBADO (2026-11-05) · Oferta sugerida: custom-agent · Precio: cotización según alcance

## Problema

El inventario se revisa a ojo; aparecen quiebres y compras de emergencia más caras.

## Qué se entrega

- Lista diaria de ítems bajo mínimo
- Cantidad sugerida según consumo
- Proveedor asociado por ítem
- Aprobación humana de la reposición

## Criterio de aceptación

Treinta días simulados sin quiebres en los ítems que tienen mínimo definido, con la sugerencia revisable en una sola pantalla.

## Qué no prometemos

No prometemos ahorro; el resultado se mide con el criterio acordado. La sugerencia depende de que el mínimo esté definido.

## Demo en quince minutos

Se carga un inventario de ejemplo, se baja un ítem del mínimo y aparece la alerta con la cantidad sugerida.

## Integraciones propuestas

- google-sheets (requiere validación técnica)
- airtable (requiere validación técnica)
- supabase (requiere validación técnica)

---

## Notas internas de revisión

- Pieza aprobada por el propietario el 2026-11-05.
- Sin precio publicado: se cotiza después de revisar alcance.
- No se conecta ninguna integración sin validarla técnicamente.
- El agente no compra, no paga y no envía nada de forma autónoma.
- Texto legal pendiente antes de publicar (ver docs/LEGAL-MINIMO.md).

# Operaciones — las 3 tareas más vendibles

Fecha: 2026-11-05 · Estado: `APPROVED` (2026-11-05, propietario)
Criterio de selección: frecuencia del dolor × facilidad de medir × bajo riesgo de datos.

---

## Selección

| # | Tarea | Por qué se vende |
|---|---|---|
| 1 | Registro de pedidos desde correo y WhatsApp a una tabla | Duele todos los días, el error es visible y la demo se hace en 15 minutos |
| 2 | Conciliación de facturas contra orden de compra | El ahorro se mide en dinero; el comprador lo entiende sin explicación |
| 3 | Alertas de stock mínimo con reposición sugerida | Evita quiebres y compras de emergencia; valor recurrente mes a mes |

Descartadas por ahora: informe diario en panel (es reporte, no tarea), vencimientos
documentales (alto valor pero ciclo de venta lento), alta de proveedor (poco frecuente),
incidencias de almacén (depende de móvil y fotos), seguimiento de envíos (depende de
transportistas externos).

---

## 1. Registro de pedidos desde correo y WhatsApp a una tabla

**Problema.** Los pedidos llegan por correo y WhatsApp, alguien los copia a mano y se pierden,
se duplican o se registran tarde.

| Elemento | Detalle |
|---|---|
| Entrada | Mensajes de pedido y el formato de pedido actual |
| Salida | Pedido con número único, cliente, ítems, cantidades, fecha y estado |
| Quién revisa | Operaciones confirma los pedidos dudosos antes de aceptarlos |
| Criterio de aceptación | 20 pedidos de prueba registrados sin duplicados ni pérdidas; menos de 2 minutos por pedido; 100% con número único |
| Integraciones | Gmail, WhatsApp Business, Sheets o Airtable (`REQUIRES_TECHNICAL_VALIDATION`) |
| Oferta | Implementación de un flujo; agente a medida si hay varios canales |
| Precio | Cotización según alcance |

**Demo en 15 minutos.** Se toma un correo real de ejemplo, se registra en vivo y se muestra el
número único y el estado.

**Riesgo declarado.** WhatsApp depende de API aprobada; si no hay acceso, se empieza por correo.

---

## 2. Conciliación de facturas contra orden de compra

**Problema.** Las diferencias de precio o cantidad se detectan al pagar, cuando ya es tarde.

| Elemento | Detalle |
|---|---|
| Entrada | Facturas en PDF y órdenes de compra |
| Salida | Tabla de conciliación con diferencias marcadas y su motivo |
| Quién revisa | Finanzas aprueba o rechaza cada diferencia |
| Criterio de aceptación | 30 facturas de prueba con diferencias sembradas: 100% detectadas, cada una con motivo y monto; sin diferencias inventadas |
| Integraciones | Correo, Drive o carpeta, Sheets (`REQUIRES_TECHNICAL_VALIDATION`) |
| Oferta | Implementación de un flujo |
| Precio | Cotización según alcance |

**Demo en 15 minutos.** Se procesan 3 facturas con una diferencia conocida y se muestra el monto
total en riesgo.

**Riesgo declarado.** PDF escaneado sin texto puede requerir OCR; se valida antes de cotizar.

---

## 3. Alertas de stock mínimo con reposición sugerida

**Problema.** El inventario se revisa a ojo; aparecen quiebres y compras de emergencia más caras.

| Elemento | Detalle |
|---|---|
| Entrada | Inventario actual, consumo histórico y mínimo por ítem |
| Salida | Lista diaria de ítems bajo mínimo, cantidad sugerida y proveedor |
| Quién revisa | Operaciones aprueba la reposición; el sistema **no compra** |
| Criterio de aceptación | 30 días simulados: cero quiebres en ítems con mínimo definido; sugerencia revisable en una sola pantalla |
| Integraciones | Sheets, Airtable o Supabase (`REQUIRES_TECHNICAL_VALIDATION`) |
| Oferta | Agente a medida (o implementación si el inventario ya está en una hoja) |
| Precio | Cotización según alcance |

**Demo en 15 minutos.** Se carga un inventario de ejemplo, se baja un ítem del mínimo y aparece la
alerta con la cantidad sugerida.

**Riesgo declarado.** La calidad depende de que el mínimo por ítem esté definido; si no existe, se
acuerda en la evaluación.

---

## Reglas comunes a las tres

- No se promete ahorro ni porcentaje: se mide después con el criterio de aceptación escrito.
- No se conecta ninguna integración sin validarla técnicamente.
- El agente **no ejecuta compras, pagos ni envíos**: solo registra y propone.
- Cada tarea se cotiza por separado; se pueden combinar en un piloto.
- Datos de clientes reales solo con consentimiento y destino aprobado.

---

## Orden de ataque sugerido

1. Semana 1: tarea 1 (más rápida de demostrar).
2. Semana 2: tarea 2 (mayor impacto económico).
3. Semana 3: tarea 3 (valor recurrente).

Cada una se entrega con criterio de aceptación escrito antes de empezar.

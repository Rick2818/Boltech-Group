# Wompi: reparación del cobro de verificación de US$1

Responsable: Codex. Solicitante: Ricardo. Fecha: 5 octubre 2026, El Salvador.

## Causa

El enlace 4478632 se creó directamente en Wompi, sin orden previa en Boltech. El retorno validó su firma y escribió `MISMATCH` en Payment Events porque no encontró la orden. Airtable estaba conectado y aceptó la escritura. El correo del proveedor confirma el cobro de US$1 a las 10:14 SV.

## Reparación

- Orden técnica importada en Payment Orders, vinculada al enlace y la transacción, inicialmente pendiente de consulta independiente.
- Recuperación administrativa restringida a pruebas de un dólar con cantidad uno. Exige evento firmado previo, misma referencia/transacción, y consulta Wompi con importe, aprobación y entorno coincidentes. Conserva el MISMATCH original y crea un evento de recuperación independiente.
- Retornos rechazados se pueden reevaluar; solo eventos firmados ACCEPTED se reconocen como duplicados válidos. Un retorno sin enlace asociado se rechaza.
- La prueba se excluye de ventas de agentes y no activa servicios.
- Endpoint privado de órdenes con cotización aprobada: `create-approved`, autenticación operacional, `approved: true`, `quoteReference`, `productId` prebuilt/custom, cantidad uno, `approvedAmountUsd` (centavos exactos), proveedor WOMPI_SV y correo del comprador. Identidad estable por referencia; Redis evita emitir enlaces duplicados incluso ante reintentos concurrentes. Un resultado incierto exige revisión, no emisión automática de otro enlace.
- Workflow sin programación recurrente usa el secreto operacional ya existente para recuperar exclusivamente la prueba autorizada. Los registros no imprimen secretos.

## Límites

El abono bancario no se verifica mediante la aprobación del pago. El endpoint comercial nuevo necesita una cotización real aprobada y su uso administrativo; no se inventan precios ni se cobra otro importe para probarlo. La creación de cotizaciones y enlaces es privada; no se ha añadido una interfaz pública para aprobar precios.

## Validación

19 pruebas de pagos y privacidad aprobadas; revisión de sintaxis de 123 módulos aprobada antes del despliegue inicial. La evidencia de recuperación final se consulta en Payment Orders y Payment Events.

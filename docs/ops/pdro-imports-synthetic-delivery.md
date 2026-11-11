# Pdro Imports — pedido ficticio de Pedro

## Alcance

Pedido `SYN_PDRO_IMPORTS_001`: atención de mensajes entrantes por WhatsApp.
La aprobación de la compra y el pago completo son declaraciones del escenario
ficticio solicitado por el titular. No se crea una transacción Wompi, una factura,
un ingreso real ni una aceptación de entrega a nombre de Pedro.

La implementación queda en `lib/customer_support_sandbox.js` y reutiliza el
contrato de mensajes de WhatsApp, sin conectar números reales ni reactivar los
componentes retirados de la fábrica. No modifica el webhook productivo de Leo.

## Recorrido ejecutable

1. Registrar el pedido ficticio y el alcance de atención.
2. Registrar el pago como `PAID_IN_FULL_SIMULATED`, sin importe inventado.
3. Crear el espacio separado `SYN_PDRO_IMPORTS`.
4. Configurar identificación, reglas, datos conocidos y límites del agente.
5. Validar el desafío de webhook y firmas de mensajes entrantes.
6. Procesar consultas; capturar respuestas solo en la bandeja de prueba.
7. Conservar conversaciones, bajas y casos para revisión de Pedro.
8. Probar duplicados, concurrencia local, errores y aislamiento.
9. Cerrar el servidor y comprobar recuperación desde archivos persistidos.
10. Entregar el sandbox para revisión; conservar la aceptación del cliente pendiente.

## Ejecución

Requiere Node.js 22 o posterior, sin instalar dependencias:

```sh
node --test tests/test_customer_support_sandbox.mjs
node scripts/ops/pdro_imports_sandbox.mjs
```

El segundo comando ejecuta las pruebas y el recorrido HTTP real en localhost.
Conserva informe, conversaciones, recibos locales y estado en
`ops-output/pdro-imports/`. Las firmas se generan con claves efímeras en memoria;
no se usan claves reales de Meta. El almacenamiento de archivos se serializa en
un proceso local; no está certificado para múltiples workers distribuidos.

## Atención configurada

- Saludar e identificar a Pdro Imports.
- Pedir producto y cantidad, sin inventar precio ni stock.
- Pedir número de pedido y crear un caso; no simular seguimiento de envíos.
- Derivar quejas, devoluciones y solicitudes de una persona a Pedro.
- Añadir mensajes posteriores al mismo caso.
- Registrar la solicitud de no recibir seguimientos.
- Rechazar pedidos de credenciales o instrucciones internas.
- Pedir texto si recibe un formato no soportado.

No se presume un catálogo, horario, dirección ni política comercial. Los campos
ausentes se comunican como pendientes de confirmación. Las respuestas actuales
usan reglas de clasificación seguras; no se presenta esa ejecución como una
llamada a un modelo generativo.

## Requisitos externos pendientes

Para una prueba real con Meta faltan un número de prueba autorizado, destinatario
de prueba, aplicación Meta con token y App Secret, un webhook HTTPS desplegado,
suscripción de eventos y prueba real de recepción/respuesta con recibos de Meta.
No conectar una cuenta real de Ricardo a la empresa ficticia sin autorización.

Para certificar IA generativa falta conectar y evaluar el modelo elegido. Para
operación comercial faltan catálogo y políticas aprobadas, almacenamiento de
producción, monitoreo y aceptación del cliente. No convertir el pago simulado,
las respuestas capturadas o una prueba verde en ingresos o entrega productiva.

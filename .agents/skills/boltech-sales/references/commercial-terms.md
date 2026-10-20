# Condiciones de Boltech — 19 octubre 2026

Fuente: main de Rick2818/Boltech-Group, config/commercial_pilot.json y lib/commercial_offer.js; condiciones de descuento y pago autorizadas por Ricardo en esta conversación.

## Precio disponible y descuento
Usar USD990 como precio del piloto «Registro, asignación y seguimiento de solicitudes», no como precio universal de agentes. Otros agentes preelaborados o a medida requieren su cotización aprobada. Verificar la fuente vigente antes de cotizar; conservar su versión en la propuesta.

Permitir descuento hasta 10% sobre el precio aprobado de implementación, sin acumular descuentos. Calcular por centavos y sobre el precio neto: USD990 con 10% = USD891; anticipo USD445.50 y saldo USD445.50. Sin descuento: USD495 + USD495. No descontar servicios de terceros ni gastos sin condiciones expresas.

## Pago
Cobrar 50% antes de comenzar y 50% al terminar, verificando los criterios de entrega acordados. Confirmar aceptación del alcance, anticipo y accesos antes de comenzar el plazo. Aceptación, anticipo, entrega y saldo son estados independientes. No llamar pagado al pedido completo por haber cobrado solo el anticipo. Conservar cotizaciones ya aceptadas y sus condiciones; no modificar Wompi.

## Alcance
Definir qué compra el cliente: problema y resultado, funciones incluidas, herramientas e integraciones, entregables, plazo, prueba de aceptación y exclusiones.

El piloto vigente contempla una empresa, un flujo web y una integración sencilla; registro de solicitudes, referencia, responsable y próxima acción, documentación y transferencia de uso. Plazo de referencia: 14 días con aceptación, anticipo confirmado y accesos disponibles. Excluir consumo de herramientas, mantenimiento recurrente e integraciones adicionales. No prometer ventas garantizadas ni disponibilidad ininterrumpida. Confirmar viabilidad técnica y detalles de la integración por cliente; ampliar funciones o plataformas requiere nueva cotización.

## Ejecución y relevo
En el repositorio, reutilizar lib/agent1_sales_skills.js: planSearch y prepare reciben commercialTerms desde config/commercial_pilot.json; commercialTerms({discountPercent:10}) permite calcular la propuesta descontada. La función no envía, no firma aprobación y no crea cobros. Agente 1 informa e investiga; conservar los responsables actuales de diagnóstico, aprobación y cierre. No crear agentes ni emisores duplicados.

## Mensualidades y verificación del sitio
La portada https://boltech-group.vercel.app/ revisada el 19 octubre 2026 muestra USD990 como implementación de pago único y los demás agentes según alcance aprobado; no publica una mensualidad verificable. Registrar importes recurrentes como pendientes de cotización, nunca como cero ni incluidos. Separar implementación, mensualidad y consumo de terceros. No aplicar automáticamente el descuento ni el anticipo 50/50 a mensualidades. No reactivar planes históricos flash/pro/enterprise ni sus tarifas retiradas. Si Ricardo proporciona otra sección con mensualidades, verificarla y actualizar la fuente antes de ofrecerla.

Aclaración expresa de Ricardo: cobrar cada mensualidad completa, sin fraccionarla. Aplicar 50% antes y 50% al terminar únicamente a implementación.

## Instrucción vigente final de Ricardo
Trabajar únicamente con el piloto USD990, con descuento autorizado hasta 10%. No ofrecer mensualidades ni precios de otros productos. La mensualidad no se divide si en el futuro se autoriza; por ahora está fuera de la oferta. Esta instrucción posterior prevalece sobre las menciones anteriores de buscar otras tarifas.

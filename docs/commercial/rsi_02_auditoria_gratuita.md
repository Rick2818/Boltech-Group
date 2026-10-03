# RSI-02 — auditoría gratuita para adquirir clientes
Fecha: 2 octubre 2026. Responsable operativo: Boltech / asistente. Responsable de acuerdos comerciales: Ricardo.
Estado: estrategia documentada; campaña y mediciones aún no ejecutadas.

## Objetivo y convivencia con Apollo
Mantener RSI-01 (prospección habitual con Apollo) y probar una segunda oferta: auditoría gratuita del recorrido de consultas/cotizaciones, seguida de demostración y piloto pagado. Apollo aporta cuentas y decisores a ambos canales; no constituye evidencia de demora.
Hipótesis: una oferta de diagnóstico concreto produce más conversaciones calificadas y pilotos pagados por cuenta elegible que el mensaje habitual. Es una hipótesis local, no una garantía de ventas.

## Primera tanda y prevención de duplicados
Trabajar primero con el ICP y las cuentas ya investigadas en RSI-01. Formar una tanda inicial de hasta diez cuentas elegibles, cinco por oferta, si hay inventario suficiente. Si no lo hay, declarar tamaño insuficiente y completar investigación sin comprar créditos nuevos.
Asignar cada empresa a una sola oferta durante la tanda. Normalizar dominio y revisar historial de Apollo, CRM, contactos previos, exclusiones y oportunidades abiertas antes de preparar contacto. Mantener la misma ventana, segmento y canal para comparar; no interpretar cinco cuentas como prueba estadística.
Registrar campaign_id, empresa, dominio, responsable, oferta asignada, fuente, último contacto, siguiente paso y evidencia.

## Oferta y ejecución
1. Preparar invitación individual identificándose como Boltech: auditoría gratuita de un canal y un recorrido comercial, sin compromiso de compra.
2. Revisar el destinatario/canal y las autorizaciones existentes antes de enviar. Este documento no activa envíos ni importaciones.
3. Con aceptación de la empresa, acordar pruebas, horario, alcance y acceso a datos. No simular una intención de compra ni solicitar cotizaciones ficticias.
4. Medir solicitudes reales autorizadas o revisar registros compartidos por el cliente. Registrar timestamp de recepción, primera respuesta automática, primera respuesta útil humana, resolución y horario laboral; reportar tamaño de muestra.
5. Entregar una página con observaciones, límites, oportunidades y propuesta de mejora. Sin datos suficientes, indicar N/D; una web o un formulario no prueban lentitud. No declarar seguimiento o escalamiento ausentes sin observarlos.
6. Demostración de 15 minutos sobre el flujo concreto. Ofrecer piloto pagado de 7–14 días, un canal y un cuello de botella, con alcance, precio, costo máximo y aceptación acordados.
7. Emitir orden conforme al contrato; medir antes/después y confirmar cobro con proveedor. La meta de 120 segundos debe acordarse y probarse; no se promete +148% ni ventas garantizadas.

## Embudo y medición
Separar cuentas elegibles, invitaciones enviadas y aceptadas por proveedor, entregas, respuestas, auditorías aceptadas/completadas, reuniones realizadas, propuestas, pilotos contratados y cobros confirmados.
Tasa de respuesta = cuentas que respondieron / cuentas contactadas; aceptación de auditoría = aceptadas / contactadas; conversión a piloto = pilotos contratados / auditorías completadas; conversión a cobro = cuentas con pago confirmado / contactadas.
Registrar costos de créditos, mensajes, IA y tiempo operativo por tanda; comparar costo por reunión calificada y por cliente pagador con RSI-01. Si denominador cero, resultado N/D.
Guardar informes individuales y datos personales en CRM privado; Git conserva metodología y resultados agregados sin PII.

## Ciclo RSI
Planificar una tanda de cinco días hábiles desde la primera invitación real. Revisar respuestas antes de ampliar volumen. Al cerrar, registrar versión, fechas, muestra, costos, objeciones y resultados verificables.
Mantener la oferta si produce avance comercial con costo sostenible; ajustar una variable si no hay respuestas; revisar alcance/precio si hay diagnósticos pero no pilotos; revisar checkout si hay acuerdos pero no cobros. No escoger ganadora solo por aperturas.
Las primeras tandas son exploratorias. Repetir antes de atribuir causalidad o escalar gasto.

## Integración operativa
Usar la revisión existente de 09:00 El Salvador; no añadir cron. El control lee las cohortes RSI-01/02 y la campaña de auditoría por separado; las lecturas ausentes permanecen N/D. Una agenda no implica ejecución de auditorías ni envío en segundo plano.
Próximo paso operativo: confirmar elegibilidad, deduplicar y preparar destinatarios/mensajes; después ofrecer la auditoría por un canal autorizado.

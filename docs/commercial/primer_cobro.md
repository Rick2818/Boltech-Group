# Boltech Group — ciclo comercial hacia el primer cobro

**Meta:** pasar de $0.00 a un cobro confirmado por el proveedor. El dashboard separa inventario de contactos, conversaciones, reuniones, propuestas, contratos y efectivo. No se transforma un registro de QA en una oportunidad real.

## Oferta de prueba

**Cliente inicial:** empresa B2B que recibe consultas, solicita cotizaciones y da soporte por correo o WhatsApp; decisor de operaciones o comercial identificable; equipo que pierde tiempo por respuestas tardías. Se exige una señal verificable del problema antes de personalizar el contacto.

**Propuesta:** diagnóstico breve del recorrido de una consulta y demostración acotada de un agente para el cuello de botella identificado. El alcance, plazo y precio de un piloto se acuerdan después del diagnóstico y requieren aprobación de Ricardo. No se promete un ahorro, porcentaje de rentabilidad ni tiempo de respuesta sin medición propia.

## Experimento de cinco días hábiles

### Integración con el control MIT de las 09:00

El workflow `.github/workflows/mit_commercial_9am.yml` ejecuta un único control a las **09:00 de El Salvador (15:00 UTC)**. Su resumen y artefacto reúnen salud, Explee, Apollo, etapas `RSI-01` y cobros. La agenda MIT generada para hoy usa la cohorte [RSI-01](rsi_01_prospectos.md) ya registrada en Airtable; si hay hot leads genuinos, los revisa primero. Apollo sirve para completar datos de decisores, sin meta automática de consumir 20–30 créditos/contactos. No se creó otro cron.

| Hora SV | Qué | Cómo | Quién | Evidencia mínima |
|---|---|---|---|---|
| 09:00 | Diagnóstico | Leer el reporte; distinguir cero verificado de N/D. | Boltech | Resumen y JSON de Actions. |
| 09:15 | Validación | Hot leads reales primero; si no existen, validar decisor y necesidad de las cinco empresas `RSI-01`. | Boltech | Fuente, rol y problema confirmado o pendiente. |
| 10:00 | Decisión | Revisar los mensajes preparados y el alcance de un piloto antes de contactar. | Ricardo | Cuentas/canales aprobados. |
| 11:00 | Contacto controlado | Preparar y, solo tras autorización, enviar contacto individual; no activar importaciones pagadas. | Ricardo + Boltech | Aceptación genuina del proveedor y registro CRM. |
| 15:00 | Respuestas | Clasificar interés y proponer diagnóstico; actualizar etapa con prueba. | Boltech | Respuesta real y próximo paso. |
| 17:30 | Aprendizaje | Revisar el embudo y cobros; cambiar una variable para la próxima tanda. | Ricardo + Boltech | Resultado y decisión documentados. |

El trabajo a las horas posteriores al cron es una agenda operativa, no ejecuciones programadas ni mensajes enviados automáticamente. La meta diaria es avanzar una etapa verificable; la meta final sigue siendo el primer pago confirmado.

| Día | Acción de Boltech | Decisión de Ricardo | Evidencia a conservar |
|---|---|---|---|
| 1 | Revisar hot leads reales de Explee; si no existen, validar decisor y necesidad de la cohorte `RSI-01` ya investigada. Apollo complementa información cuando corresponda. | Aprobar oferta y mensajes antes del contacto. | Fuente de la empresa, decisor y problema confirmado o pendiente; autorización del canal. |
| 2 | Clasificar respuestas y preparar agenda de diagnóstico. | Conversar con interesados. | Respuesta genuina o confirmación de reunión. |
| 3 | Sintetizar el cuello de botella y redactar una propuesta de piloto concreta. | Validar alcance, precio y condiciones. | Notas de reunión y propuesta enviada. |
| 4 | Revisar objeciones y preparar un seguimiento individual. | Aprobar cualquier concesión o contrato. | Respuesta del cliente y siguiente paso fechado. |
| 5 | Comparar etapas y fuente de evidencia; cambiar solo una variable (ICP, problema, canal o mensaje) para la siguiente tanda. | Decidir conservar o ajustar el experimento. | Cobro confirmado o motivo de bloqueo documentado. |

No se despachan correos ni se consumen créditos mediante este plan. Una importación de campaña en Explee puede comenzar envíos y generar cargos; requiere decisión expresa sobre destinatarios y presupuesto.

## Regla de decisión diaria

1. **Cobro desconocido:** reparar medición. No convertir ausencia de datos en $0.
2. **Cobro $0 y hot leads genuinos:** responder interés existente antes de ampliar la lista.
3. **Sin hot leads, con `RSI-01` en investigación:** validar decisor y necesidad antes de contactar; Apollo ayuda a completar el dato.
4. **Sin empresas verificables:** obtenerlas antes de editar la web o la oferta otra vez.
5. **Primer cobro confirmado:** identificar canal, necesidad y oferta para repetir el proceso.

**Registro mínimo por oportunidad:** origen, empresa, decisor, evidencia del problema, fecha de contacto, respuesta, reunión, propuesta, estado y referencia del pago. Las respuestas, reuniones y propuestas muestran `N/D` hasta conectarse a una fuente real. Los presupuestos de referrals y un estado `WON` no prueban dinero cobrado.

**Fuentes de operación:** [Explee Public API](https://api.explee.com/public/api/docs) documenta hot leads, conversaciones y analítica de campaña; [Apollo Sequence Reports](https://knowledge.apollo.io/hc/en-us/articles/9386141889549-Report-on-Sequences) permite medir entregas, respuestas e interés cuando hay secuencias activas. Conectar esas etapas exige acceso real y se valida antes de publicar cifras.

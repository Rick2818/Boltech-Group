# Plan de orquestación para el lunes 19 de octubre de 2026

**Corte de verificación:** 2026-10-18 18:11 America/El_Salvador
**Rama de trabajo:** `codex/unified-agents-asmas-20261018`
**Veredicto:** plan operativo revisado; la ejecución exacta de todos los roles a las 07:00 y el cierre de una venta mañana no están certificados.

## Alcance y límites

Este documento organiza el trabajo para una oportunidad real existente. No cambia archivos de agentes ni activa otra automatización. Todo cambio posterior de agentes debe quedarse en la rama indicada, según instrucción de Ricardo. La computadora puede estar apagada porque GitHub Actions usa `ubuntu-latest`; el horario programado por GitHub puede retrasarse o perderse. El trabajo externo solo se ejecuta de lunes a viernes entre 08:00 y 17:59 hora de El Salvador. A las 07:00 se permite únicamente preparación interna.

El mapa de trabajo propuesto es A1 = RSI-01, A2 = RSI-02, A3 = RSI-03, A4 = Director de Ventas y Mercadeo, y Mercadeo = `marketing-director`. El inventario de la rama declara esa equivalencia como conceptual: no demuestra que las nuevas identidades ASMAS estén conectadas o desplegadas en producción.

## Evidencia que sostiene el plan

- El workflow `Boltech Director Agent 4 hourly oversight` está activo en `main` y usa un runner alojado de GitHub. Su cron `10 * * * *` corresponde a las :10 de cada hora UTC, incluida aproximadamente las 07:10 de El Salvador. La corrida programada más reciente visible, `39171983856`, se ejecutó el 18 de octubre a las 16:23 hora local. Las pruebas, Mercadeo y RSI-02/RSI-03 terminaron correctamente; el paso final `Audit Director oversight receipt` falló. El workflow actual no ejecuta RSI-01.
- `Agent 1 autonomous discovery` está activo en `main` para las 09:15 hora local, pero aún no muestra una corrida real. La acción de control `Agent 1 lead gate QA` sí pasó; eso prueba el QA, no el runtime. El recibo esperado de A1 debe indicar observación real y separar las oportunidades freelance de compradores; no debe enviar propuestas, mensajes ni consumir Connects.
- El dominio público de Vercel respondió HTTP 200. En la corrida del Director, las llamadas de preparación al ejecutor Vercel y los pasos de Mercadeo y RSI-02/RSI-03 terminaron correctamente y el auditor falló después. Esto prueba disponibilidad en esa corrida, no que cada rol o cada credencial esté listo ahora.
- Airtable muestra la oportunidad web `reciEmqj39n3eILYO` (“Tu chuchito”) como `Replied`, y la tarea existente `recR4R4mXVdx7IvIc` como `PENDING_RSI01_RESEARCH`. Las notas registran `INTERESTED`, pero el correo declarado sigue `emailVerified=false`; la lectura de Gmail no estuvo disponible en esta sesión. El problema no está confirmado y no hay aceptación.
- El pedido comercial configurado es USD 990, con USD 495 al inicio y USD 495 contra entrega verificada, 14 días desde aceptación y accesos. Cubre una empresa, un flujo web y una integración sencilla; herramientas y mantenimiento están fuera del precio. El registro de configuración dice `paymentEnabled=false`. La consulta actual no mostró ningún pago comercial verificado; el pago QA de USD 1 queda excluido.
- Upwork y el tablero público de trabajos de n8n son fuentes de oportunidades freelance. No son leads de compradores de Boltech. El feed comunitario de n8n es solo lectura. La autorización MCP de Upwork aún no se ha verificado en el runtime de A1.

## Secuencia propuesta para el lunes

| Hora SV | Responsable | Acción y condición para avanzar |
|---|---|---|
| 07:00 | A4 | Inicio interno: conciliar el lead web, su tarea, las órdenes de pago, recibos recientes y cualquier respuesta comercial disponible. No enviar mensajes. El workflow desplegado hoy dispara a las 07:10, no a las 07:00, y no ejecuta A1. |
| 07:10 | A4 + Mercadeo + A2/A3 | Reutilizar el ciclo horario existente para revisar recibos, bloqueos y propietarios. A4 conserva `ATTENTION_REQUIRED` hasta que el rol dueño registre evidencia verificable de resolución; no cambiarlo a verde por una corrida técnica. |
| 07:15 | A1 / RSI-01 | Revisar identidad, historial, autorización y canal de la solicitud web. Conciliar el `threadId`/`sentId` anotado con el buzón comercial. Si no puede verificarse el remitente y el canal, conservar el caso pendiente y no contactar. Mantener Upwork y n8n freelance en su cola separada. |
| 07:30 | Mercadeo | Preparar solo un apoyo privado para el bloqueo concreto: respuesta escrita sobre registro y seguimiento de consultas. No publicar, no usar Flova mientras el MCP siga sin conexión y no afirmar resultados o ROI. RSI-01 revisa y acepta el material antes de usarlo. |
| 08:00–09:00 | A1 → A2 | Si A1 verifica identidad y canal y no existe envío pendiente, responder una sola vez por escrito dentro de la autorización recibida. Registrar antes el intento durable y después leer el recibo del proveedor. Si llega respuesta humana, A2 confirma proceso actual, volumen, herramientas, responsable, impacto, fecha y límites. No proponer todavía si faltan datos críticos. |
| 09:00–12:00 | A2 → A3 | A2 confirma si el flujo existente puede resolver la necesidad. La mención de WhatsApp no autoriza prometer WhatsApp API. A3 revisa integración, credenciales, costos y condiciones. Solo si el alcance encaja, prepara la propuesta escrita aprobada y sin cambiar precio ni términos. |
| 12:00–14:00 | A3 + A4 | Presentar la propuesta únicamente por un canal verificado, si el comprador la solicitó o confirmó que la quiere. Pedir aceptación expresa del alcance, importe y condiciones. No ofrecer llamada o reunión. No solicitar pago mientras la ruta de pago no esté habilitada y verificada. |
| 14:00–16:30 | A1/A2/A3 | Atender respuestas y seguimientos que estén vencidos y autorizados. No repetir los cuatro mensajes `N8N_OUTREACH` del 18 de octubre; siguen esperando respuesta. Los trabajos freelance se revisan aparte y no generan postulaciones ni gasto. |
| 16:30–17:00 | A4 | Cerrar auditoría del día: receipts, responsable, evidencia, estado, próxima fecha; marcar `GREEN` solo con resolución persistida y releída. Aceptación y pago se registran por separado. Si no hay respuesta o aceptación, dejar el estado real pendiente. |

## Criterios de cierre

1. **Respuesta:** mensaje humano leído en el proveedor y asociado al hilo correcto; una etiqueta interna no basta.
2. **Calificación:** necesidad, proceso, herramientas, responsable, impacto, fecha y límites confirmados por escrito.
3. **Propuesta:** alcance ejecutable, integración y costos verificados, condiciones aprobadas y recepción comprobable.
4. **Aceptación:** consentimiento explícito del comprador al alcance, importe y condiciones.
5. **Pago:** referencia de producción confirmada por el proveedor y asociada al pedido; excluir QA.

Una respuesta amable, un run `COMPLETED`, una cotización preparada o la apertura de un link no cuentan como pago. La venta de mañana depende de decisiones del comprador y no se puede prometer.

## Certificación y activación

**Aprobado:** este plan usa la oportunidad existente, asigna una puerta concreta a cada rol, separa el canal freelance y respeta el horario, el presupuesto y la regla de no duplicar contactos.

**En espera:** no se certifica un inicio automático de los cinco roles a las 07:00. En `main`, A4 corre a las 07:10 y su última auditoría quedó en fallo; A1 aparece programado a las 09:15 y todavía no tiene recibo real. Los cambios solo en esta rama no alteran los workflows programados de `main`. La documentación oficial de GitHub confirma que un cron programado solo corre desde la rama predeterminada y puede retrasarse o perderse: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows.

**Vercel:** no se agrega otro cron. Si la cuenta está en el plan Hobby, Vercel solo permite una ejecución diaria por cron y puede invocarla en cualquier minuto de la hora configurada; no sirve para prometer las 07:00 exactas. Fuentes: https://vercel.com/docs/cron-jobs/usage-and-pricing y https://vercel.com/docs/cron-jobs/manage-cron-jobs.

**Siguiente verificación necesaria para activar 07:00 exactas:** integrar de forma controlada en la rama predeterminada un cambio de horario que conserve la supervisión existente y no duplique la ejecución de las 07:10, luego comprobar una corrida programada y sus cinco recibos. La carpeta `main` local está atrasada 125 commits y tiene cambios no confirmados; no se usó para esta tarea. No se necesita crear un runner nuevo: el runner alojado existente es suficiente una vez que el workflow y los permisos estén verificados.

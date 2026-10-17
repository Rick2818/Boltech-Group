# RSI-01: corrección del ejecutor diario

17 octubre 2026. Solicitud de Ricardo: corregir la ejecución de la campaña diaria. Responsable técnico: Codex.

## Diagnóstico comprobado

RSI-01 ya tenía ejecutor en `rsi_agent_executor.js` y GitHub programaba el workflow `asmas_rsi01_9am.yml` a las 15:00 UTC/09:00 SV. No faltaba una clase o agente nuevo. La ejecución programada del 16 octubre, [38947975007](https://github.com/Rick2818/Boltech-Group/actions/runs/38947975007), comenzó a las 18:31:16Z/12:31 SV, con más de tres horas de retraso. El recibo tenía RSI-01 BLOCKED por Gmail/evidencia, campaña `NO_APPROVED_LEADS`, reviewed=226, approvedTotal=0, eligible=0; el workflow quedó success. Estos son resultados históricos, no cifras actuales.

Al revisar el 17 octubre alrededor de 09:24 SV no aparecía todavía la ejecución programada de hoy en GitHub. Eso prueba ausencia de recibo observado, no el motivo interno del retraso de GitHub. `CRON_SECRET` está configurado para Production en Vercel; no se reveló su valor. El cron nativo ya existente sí apuntaba a `commercial-activation`, pero esa rama no invocaba el ejecutor RSI-01 ni la campaña SDR. La consulta acotada de logs no recuperó una ejecución de hoy; ausencia de logs no demuestra que Vercel jamás la intentó.

## Decisión y flujo mínimo

Se conserva una aplicación, agentes existentes, remitente corporativo, cron Vercel de las 09:00 y workflow GitHub existente. No hay nuevo cron, modelo, proveedor, coste ni cambios Wompi.

Vercel cron autenticado → coordinador diario → ejecutor RSI-01 existente → cola SDR de contactos individualmente aprobados → recibo Redis. GitHub usa el mismo coordinador mediante endpoint privado y procesa después RSI-02/RSI-03/MARKETING; ya no ejecuta un segundo bucle independiente de RSI-01.

La exclusión diaria usa fecha de El Salvador y lease atómico compartido. Estado FINISHED devuelve el recibo anterior. Estado RUNNING/UNKNOWN exige conciliación; vencer el lease no autoriza repetir. Las deduplicaciones y autorizaciones existentes del remitente siguen vigentes. Un bloqueo de investigación no autoriza contactos nuevos; una cola aprobada independiente conserva su autorización individual.

El cron conserva también sus operaciones previas de Mercadeo, recepción y adquisición. La duración y límites de Vercel siguen vigentes; un timeout se detecta por recibo incompleto y requiere conciliación, no reenvío a ciegas.

## Aceptación, evidencia y límites

- 34/34 pruebas locales: ejecución única entre instancias, concurrencia, día siguiente, medianoche SV, resultado desconocido sin repetición, cero aprobados visible y monitor que distingue omisión de bloqueo comercial; regresión OAuth y cron existente.
- GitHub espera por lecturas a que producción sirva su revisión antes del POST; no repite POST incierto. Un resultado diferente de EXECUTED produce salida no cero y preserva el recibo.
- El monitor existente consulta el ledger privado desde las 09:30 SV. Omisión o estado inconcluso falla; bloqueo comercial terminado queda ATTENTION. El monitor no inicia campañas.
- Recibos diarios se conservan en Redis y en el artefacto `asmas-rsi01-9am-{run_id}`. No contienen correos ni texto de clientes.
- Pendientes al escribir: CI, integración, despliegue y ejecución real, que se registran en [harness #86](https://github.com/Rick2818/Boltech-Group/issues/86).

Esto corrige el cableado del ejecutor; no convierte investigación en autorización, no crea compradores, no asegura horario exacto de infraestructura externa ni acredita ventas. El informe de este flujo es un recibo en GitHub/harness: no se implementó aquí un nuevo envío de informe a correo o Telegram. El aviso existente de Dirección continúa reservado para pagos verificados.

Rollback: revertir este cambio de código/workflow, conservando el ledger y conciliando cualquier envío incierto. No borrar recibos para forzar otra campaña.

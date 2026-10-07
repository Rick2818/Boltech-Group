# Comunicación Ventas y Mercadeo mediante n8n

Responsable: Dirección de Ventas y Mercadeo. Ricardo decide alcance, condiciones nuevas y gastos. Usar los tres agentes y marketing-director existentes.

Ruta: RSI solicita apoyo o reporta bloqueo → n8n valida identidad/tipo → Dirección aplica política → Mercadeo entrega material ES/EN → resultado vuelve al RSI solicitante → ventas registra aceptación, uso y resultado en notas CRM. Una solicitud requiere eventId único, opportunityId del CRM, from (RSI-01/02/03), type y problem. Las identidades externas y problemas no permitidos se rechazan.

## Decisiones autorizadas

| Problema | Alternativas acotadas |
|---|---|
| Sin respuesta | Revisar encaje/historial; reformular problema específico; seguimiento escrito en hilo existente |
| Datos faltantes | Investigar fuente empresarial; pedir mínimo por escrito; preparar alcance reducido para validar |
| Demostración no disponible | Explicación escrita del proceso; grabación verificada existente; validación técnica |
| Objeción de precio | Aclarar alcance/valor; evaluar alcance menor con aprobación; Dirección decide precio |
| Fallo de herramienta | Consulta de estado; material privado local y sincronización pendiente; escalar fallo |
| Envío incierto | Conciliar comprobante, sin reenviar |
| Rebote | Suprimir dirección; investigar otro canal empresarial publicado |

Máximo tres alternativas; registrar intento y resultado antes de avanzar. Las acciones son recomendaciones operativas entregadas al responsable: no declaran que la herramienta alternativa ya funcionó. Ninguna cambia precios, gasto, permisos o compromisos por sí sola.

El coordinador conserva ahora el contador por oportunidad, compartido entre roles y problemas, y recupera el historial anterior. Cambiar eventId, from o problem no inicia otro presupuesto de intentos. Cada avance exige un FAILED registrado con evidencia real, o el recibo persistido de un fallo de ejecución de lectura del servidor. Después del límite, la oportunidad queda en revisión de Dirección.

Ejecuciones automáticas permitidas: preparar y persistir material específico; consultar estado real de Gmail; revisar historial real con el contacto CRM validado. Se guardan action, status, verified y el recibo o código de fallo. Repetir el mismo evento recupera el recibo sin repetir la consulta. Las demás acciones conservan PENDING_AUTHORIZED_EXECUTION o DIRECTOR_DECISION_REQUIRED y alternativeExecuted=false hasta que exista ejecución y evidencia: no se inventan seguimientos enviados, grabaciones verificadas ni cambios de precio.

## Cierre y aviso

Solo RSI-03 emite CLOSE_REPORTED con referencia de evidencia. RSI-03 cierra e informa a Directora; Directora verifica aceptación/alcance y pago proveedor y después informa a Ricardo. Un aviso no prueba ingreso. n8n devuelve notificación pendiente; el consumidor de Dirección debe leerla y efectuar el aviso. No se considera Ricardo notificado por crear la ejecución.

Los agentes usan scripts/ops/n8n_agent_message.mjs con archivo de evento local y firma HMAC por rol. n8n remite al coordinador privado cloud; el servidor valida cuenta CRM real y persiste evento y cola durable. El ledger local complementa ese registro y no sustituye la cola cloud. Dirección ejecuta `node scripts/ops/interagent_control.mjs queue`. Tras verificar y avisar a Ricardo, usar `acknowledge` con archivo que incluya from DIRECTORA, eventId, evidenceRef, verified true y communicationRef; jamás registrar aviso antes de realizarlo. CLOSE_REPORTED exige orderId y acceptanceRef, pago de producción con evidencia del proveedor y vínculo con la cuenta; excluye payment-verification y oportunidades QA.

Ventas lee su cola mediante `interagent_control.mjs queue archivo.json` con from del RSI. Registra resultado con acknowledge; para FAILED adjunta evidenceRef. El servidor exige ese resultado guardado antes de aceptar previousEventId/previousOutcome/resultEvidenceRef y avanzar la alternativa; el contador viene del servidor. La firma distingue roles de red; las claves locales están en un archivo privado de un host de confianza, no equivalen a aislamiento entre usuarios del sistema operativo.

Para un acuse de ventas, evidenceRef debe identificar un correo real de Gmail asociado al cliente de la oportunidad: salida del correo comercial al cliente o respuesta del cliente al correo comercial. Se rechazan referencias inventadas, respuestas automáticas y evidencia de otra cuenta. Un fallo técnico sin mensaje verificable queda pendiente de revisión; no fabricar un acuse. El cierre también exige coincidencia de pedido, producto, importe y cliente con el alcance aprobado, aceptación real en el hilo y comprobación independiente del proveedor. La llave compartida de la entrada local por sí sola no autoriza estas acciones.

## Archivos y ejecución

- config/n8n/boltech_sales_marketing.json: workflow de seis nodos, sin secretos, importable.
- scripts/ops/build_n8n_sales_marketing.mjs: genera el workflow desde la política y la oferta vigentes.
- scripts/ops/prepare_n8n_credentials.mjs: prepara autenticación local en scratch ignorado por Git.
- scripts/ops/n8n_agent_message.mjs: cliente local con reserva por evento, conflicto de ID y resultado UNKNOWN sin reintento ciego.

Para conciliar un envío incierto: `node scripts/ops/n8n_agent_message.mjs archivo-evento.json --reconcile`. Consulta únicamente el recibo cloud autenticado del evento original; no reenvía al webhook. El recibo sigue disponible después de retirar el evento de la cola por acuse. Si no existe, no coincide, falla la consulta o el estado es PENDING/UNKNOWN/REJECTED, el proceso termina con código 1. Solo un recibo durable confirmado permite código 0. Los ledgers históricos RECEIVED sin recibo verificable vuelven a UNKNOWN. La actualización local usa un archivo temporal y reemplazo para evitar truncar el ledger; la reserva inicial sigue siendo exclusiva. La deduplicación final es atómica en el coordinador cloud, también para entradas directas.
- lib/rsi_agent_executor.js: persiste apoyo por oportunidad dentro de BOOTSTRAP RSI existentes. Esa entrega privada funciona independientemente de n8n; no se cuentan dos tareas o emisores.

La instancia local se limita a 127.0.0.1:5678 y depende de que este equipo siga encendido. Los ejecutores cloud pueden usar el mismo coordinador durable directamente y no necesitan acceder a localhost. No prometer disponibilidad permanente del equipo local. No se contrata hosting nuevo. Datos/credenciales locales en scratch/commercial-scale/n8n-runtime excluidos de Git. INTERAGENT_ROLE_KEYS se conserva como secreto de producción; no incluir valores en workflow, Git o salida.

Fuentes oficiales: https://docs.n8n.io/workflows/export-import/ ; https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/ ; https://docs.n8n.io/hosting/cli-commands/ .

## Separación local/cloud — comprobación del 7 octubre, 15:26 SV

La entrada local entrega eventos por HTTPS al coordinador cloud existente. Los clientes cloud usan directamente ese coordinador; no intentan llamar a localhost. La cola durable cloud es la fuente común de pendientes. El ledger local conserva comprobantes complementarios.

Verificación actual: `node scripts/ops/verify_n8n_communication.mjs`, ocho controles PASS. Los tres RSI recibieron sus materiales existentes con `reused=true`, sin duplicar tareas; firmas inválidas y cierres sin pago fueron rechazados. `node scripts/ops/interagent_control.mjs queue` respondió correctamente para Dirección, sin pendientes ni venta inferida. Evidencia privada: `scratch/commercial-scale/n8n-communication-verification.json`, timestamp UTC 2026-10-07T21:26:20.672Z.

Operación supervisada: comprobar esa recepción al iniciar cada sesión y después de reiniciar el equipo. Si la prueba falla, registrar el fallo y revisar el servicio antes de aceptar entregas locales como confirmadas. Conservar las claves y la base de datos existentes; no reinstalar ni reenviar operaciones inciertas. Los clientes cloud pueden consultar la cola común aunque n8n local esté apagado; esto no convierte en cloud las tareas que dependen de herramientas locales.

Estado de la observación: comunicación entre entrada local y cola cloud comprobada; disponibilidad continua y recuperación tras reinicio pendientes de prueba. ACTIVE expresa programación, no una ejecución confirmada. No se contrató alojamiento, no se abrió un túnel público y no se autorizó gasto. Un servicio continuo requiere decisión de Ricardo sobre alojamiento y presupuesto.

## Evidencia 7 octubre 2026

n8n 2.36.8 existente reparado (binario SQLite faltante), autenticación importada sin imprimir secreto, workflow importado y publicado. Prueba HTTP local a las 13:01 SV: ocho controles PASS, incluidos los tres roles, alternativa, envío incierto, identidad inválida, acceso sin credencial y aviso RSI03 a Dirección sin atribuir cobro. SQLite contiene ejecuciones success verificadas. Artefacto privado: scratch/commercial-scale/n8n-communication-verification.json. La instancia local está operativa; publicación social, demostración real, comunicación cloud hacia localhost y cierre comercial no se acreditan por esta prueba.

# Leo — Motor autónomo de ejecución verificada (versión acotada)
**Boltech Group, 3 noviembre 2026**

## Alcance real
El motor integra objetivos existentes de Leo, aislamiento multicliente (tenant + owner), Redis con actualización atómica CAS, cola ZSET de tareas, planificación determinista a partir de referencias HTTPS autorizadas, aprobación humana, ejecución limitada de herramientas de **solo lectura** y recibos inmutables por paso. Los fallos bloquean la tarea; un claim persistido de lectura que lleva más de 150 segundos puede reanudarse hasta 3 intentos. Una ejecución finalizada queda en AWAITING_REVIEW hasta que el administrador valida el resultado; no se marca como entregada o completada automáticamente.

Herramientas permitidas por el motor: inspect_objective (lectura del objetivo propio), fetch_public_reference (HTTP GET hacia lista corta de dominios de documentación oficiales, sin redirect ni credenciales, con tamaño máximo y digest SHA256) y compile_evidence_report (inventario de evidencia para revisión). No ejecuta comandos shell, envía mensajes, hace bids, gasta Connects, cobra ni llama un LLM externo.

**Límites**: No es ChatGPT Dots oficial, no ejecuta tareas abiertas arbitrarias, no garantiza respuestas de sitios públicos, no automatiza correo/calendario/WhatsApp ni interpreta documentos con un LLM. Un fetch exitoso solo demuestra que se obtuvo contenido y se generó un recibo; **no** valida la veracidad del contenido ni equivale a investigación exhaustiva.

## APIs y esquema
POST /api/leo-objectives con token HMAC de aprovisionamiento de tenant verificado, rol tenant_admin para habilitar ejecución. No se deben emitir tokens en el frontend ni compartir el secreto del servidor.

1. Crear objetivo con un campo delegation.sources que incluya URLs HTTPS exactas de fuentes oficiales admitidas (hasta 3 para una ejecución).
2. automation_prepare: input = {id, expectedVersion, eventId}. Valida fuentes, genera pasos y devuelve el plan persistido. No ejecuta nada.
3. automation_approve: input = {id, expectedVersion, eventId, approval:true}. Requiere rol administrador y encola solo el plan aprobado.
4. progress: {operation:"progress",id}. Consulta estado, pasos, recibos y última evidencia sin alterar el objetivo.
5. automation_requeue: input = {id, expectedVersion, eventId, approval:true}; permite reintento revisado de una tarea bloqueada.
6. automation_cancel: input = {id, expectedVersion, eventId}; revoca aprobación y elimina la cola. No puede revertir acciones ya completadas; este motor no permite acciones de escritura.
7. transition complete: la revisión humana cierra el objetivo solo cuando el último paso tiene un recibo verificado.

Ruta interna del ejecutor: POST /api/leo-autonomy-worker. Solamente acepta token de scheduler de servidor existente y requiere LEO_AUTONOMY_ENABLED=1. No acepta IDs ni herramientas arbitrarias proporcionadas por el llamador. Si falta flag, devuelve DISABLED. Deshabilitar la bandera detiene ejecución autónoma sin tocar el resto de Boltech.

## Plan de integración operacional sin nuevo cron
Supabase (proyecto Boltech Group) ya usa boltech-research, boltech-marketing y boltech-receipts. Mantener el mismo número de jobs. Usar **la invocación existente de boltech-receipts**, a un intervalo conservador de 15 minutos, para llamar la ruta interna con el secreto ya guardado en Supabase Vault boltech_scheduler_secret. Nunca copiar el secreto a Git, logs o chat.

La modificación de SQL únicamente debe hacerse cuando:
- el commit haya pasado pruebas de regresión y Governance;
- el endpoint esté desplegado en Vercel y la bandera habilitada;
- se hayan verificado permisos del scheduler y las variables de entorno sin exponer valores;
- se pueda comprobar el resultado HTTP de la llamada real en boltech_ops.http_receipts.

La cola no ejecuta trabajos antiguos: solo objetivos que reciban una nueva aprobación explícita mediante automation_approve. Los antiguos ciclos de cold email permanecen retirados. No se modifica la función de facturación Wompi.

## Pruebas
node --test tests/test_leo_autonomous_engine.mjs tests/test_leo_tenant_autonomy.mjs tests/test_leo_delegation_brief.mjs tests/test_leo_objective_http_e2e.mjs
npm run improve:check
npm run build

Validar luego en GitHub Actions el commit exacto y en Vercel la revisión productiva; sin una muestra de ejecución real de cliente autorizado **no** afirmar autonomía comercial ni paridad con Dots.

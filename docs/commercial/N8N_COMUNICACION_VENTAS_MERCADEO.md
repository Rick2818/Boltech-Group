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

## Cierre y aviso

Solo RSI-03 emite CLOSE_REPORTED con referencia de evidencia. RSI-03 cierra e informa a Directora; Directora verifica aceptación/alcance y pago proveedor y después informa a Ricardo. Un aviso no prueba ingreso. n8n devuelve notificación pendiente; el consumidor de Dirección debe leerla y efectuar el aviso. No se considera Ricardo notificado por crear la ejecución.

Los agentes usan scripts/ops/n8n_agent_message.mjs con archivo de evento local; su resultado queda en el ledger privado. En cada ciclo de Dirección, ejecutar scripts/ops/read_n8n_director_queue.mjs. Tras verificar y avisar a Ricardo, marcar el eventId con ese mismo script; jamás marcarlo antes. Los eventos QA no se presentan como cierres comerciales.

## Archivos y ejecución

- config/n8n/boltech_sales_marketing.json: workflow de seis nodos, sin secretos, importable.
- scripts/ops/build_n8n_sales_marketing.mjs: genera el workflow desde la política y la oferta vigentes.
- scripts/ops/prepare_n8n_credentials.mjs: prepara autenticación local en scratch ignorado por Git.
- scripts/ops/n8n_agent_message.mjs: cliente local con reserva por evento, conflicto de ID y resultado UNKNOWN sin reintento ciego.
- lib/rsi_agent_executor.js: persiste apoyo por oportunidad dentro de BOOTSTRAP RSI existentes. Esa entrega privada funciona independientemente de n8n; no se cuentan dos tareas o emisores.

La instancia local se limita a 127.0.0.1:5678. No es accesible a GitHub/Vercel y depende de que este equipo siga encendido. No prometer comunicación cloud continua hasta contar con alojamiento y verificar la conexión real. No se contrata hosting nuevo. Datos/credenciales locales en scratch/commercial-scale/n8n-runtime excluidos de Git.

Fuentes oficiales: https://docs.n8n.io/workflows/export-import/ ; https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/ ; https://docs.n8n.io/hosting/cli-commands/ .

## Evidencia 7 octubre 2026

n8n 2.36.8 existente reparado (binario SQLite faltante), autenticación importada sin imprimir secreto, workflow importado y publicado. Prueba HTTP local a las 13:01 SV: ocho controles PASS, incluidos los tres roles, alternativa, envío incierto, identidad inválida, acceso sin credencial y aviso RSI03 a Dirección sin atribuir cobro. SQLite contiene ejecuciones success verificadas. Artefacto privado: scratch/commercial-scale/n8n-communication-verification.json. La instancia local está operativa; publicación social, demostración real, comunicación cloud hacia localhost y cierre comercial no se acreditan por esta prueba.

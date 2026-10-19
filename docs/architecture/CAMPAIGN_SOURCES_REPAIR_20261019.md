# Campaña y fuentes del agente 1 — 19 octubre 2026

Responsable: ChatGPT/Codex. Solicitante: Ricardo. Alcance autorizado: corregir y verificar la campaña y vincular Upwork/n8n para reducir dependencia de Apollo. Presupuesto: USD0. No se crean agentes, calendarios independientes, compras ni otro emisor.

## Resultado y decisiones

Flujo mínimo: coordinador existente → investigación de fuentes independientes → preparación y verificación de exactamente cinco contactos → despacho en la ventana permitida mediante el ledger existente. Los prospectos por plataforma conservan su canal. Una publicación no se presenta como correo preparado, comprador validado, respuesta, venta ni pago.

El workflow anterior preparaba antes de investigar; el diagnóstico separado corría a las 09:15 SV después del envío de las 09:00. Se retira ese segundo calendario: queda manual. El coordinador prepara desde las 08:00, 08:15, 08:30 y 08:45 de lunes a viernes; despacha desde las 09:00 tras la puerta de cinco, con los reintentos acotados existentes. GitHub puede retrasar horarios. Un push ejecuta investigación y preparación, nunca el paso de campaña.

## Fuentes y límites

| Fuente | Conexión implementada | Evidencia necesaria |
|---|---|---|
| Apollo | Integración existente; no se desactiva | Inventario e historial verificados para el canal correo |
| n8n Community Jobs | Lectura HTTPS pública de categoría 13 y del primer mensaje del autor | Fuente, fecha, autor, solicitud, canal y recibo de almacenamiento; máximo cinco señales nuevas por día SV |
| Upwork | Adaptador de lectura del MCP oficial `https://mcp.upwork.com/mcp`; Vercel Connect vinculado al proyecto | OAuth de usuario del servidor mediante identidad OIDC y configuración de propietario; cuenta `TALENT` comprobada y `find_jobs`. La sesión del complemento de ChatGPT no se copia al servidor |
| n8n Cloud | No certificado | URL de instancia activa y autorización MCP. La URL anterior devolvió «No instance here» y la consola presenta verificación humana |

El MCP oficial de Upwork usa OAuth 2.1 y registro dinámico, por lo que no hace falta solicitar una clave propia para usar el complemento oficial. La callback API previa se conserva; no se confunde con conexión MCP. El adaptador servidor no inventa un token ni toma credenciales del navegador. Vercel Connect administra la renovación cuando el proveedor concede OAuth; ausencia o error queda como bloqueo visible y n8n continúa independientemente. Se conserva el token estático anterior solo como compatibilidad cuando no hay conector administrado configurado; no se usa para eludir errores de Connect.

n8n Jobs y n8n Cloud son conexiones distintas. La lectura pública no exige contraseña y no certifica acceso a la instancia. El adaptador ignora anuncios de proveedores, solicitudes antiguas/cerradas y respuestas de otros freelancers. Solo registra investigación en la tabla Work existente, deduplica por plataforma/ID, verifica el recibo y nunca inventa correos ni envía propuestas. La cola de correo mantiene intacta su validación de cinco contactos completos. No se fabrican cinco correos a partir de publicaciones.

## Recuperación y controles

Fallos temporales de lectura/investigación pueden reintentarse hasta tres veces por día con cinco minutos de separación. Historial Gmail/Apollo, bajas y rechazos permanentes no se borran ni se eluden. Inventario agotado indica faltantes, responsable RSI-01 y necesidad de reemplazos. Wompi, tarifas, pagos y oferta no cambian.

## Verificación y evidencia

- Línea base: Actions `39150654216`, job `117743435161`, falló con `SOURCE_EXHAUSTED_BEFORE_FIVE`, cero seleccionados y rechazos `APOLLO_SAVED_ACCOUNT_REVIEW_REQUIRED`.
- Upwork: complemento autorizado respondió para la cuenta Ricardo Bolanos, Freelancer, y devolvió cinco publicaciones sobre n8n mediante lectura. Esto acredita el complemento, no OAuth del servidor ni elegibilidad para postular.
- n8n Community: lectura real devolvió cinco solicitudes; IDs `322466`, `319256`, `321244`, `317002`, `315672`. `verifiedBusinessLeads=0`, `sendingEnabled=false`.
- Pruebas locales iniciales: 73 aprobadas, cero fallos, incluyendo límites, duplicados, ventanas, recuperación, fuente caída, escritura no confirmada, canales y ausencia OAuth. La verificación de producción se documenta tras publicar.

Rollback: revertir únicamente los archivos de esta corrección mediante commit. Conservar ledger de envío, historial, registros ya creados y bloqueos; no borrar datos para repetir campañas. El criterio final exige recibo productivo del agente con fuentes observadas y readback de los cinco contactos antes de considerar lista una campaña.

## Conexión de servidor autorizada y seguimiento de revisión

Ricardo autorizó «la conexión al servidor» el 19 octubre, después de revisar Vercel Connect y su límite gratuito. Se verificó el conector `scl_4OqeLvreUTfH5k0O3sHWAg`, UID `mcp.upwork.com/boltech-group`, vinculado a Boltech en producción, preview y development. No se contrató un plan. La prueba de token de aplicación fue rechazada por Upwork con `invalid_client` (HTTP 400). No se presenta como autenticación correcta. El flujo de usuario abrió el inicio de sesión de Upwork.

El servidor usa el UID configurado, su OIDC de proyecto y una identidad de propietario fijada en configuración a partir de la cuenta TALENT comprobada. El consumidor no puede elegir sujeto, cuenta, endpoint, permisos ni URL de retorno mediante entradas de API. Solo se invocan `list_accounts` y `find_jobs`; no hay propuestas, compras ni mensajes. La ruta operativa existente añade `rsi01-platform-sources`: GET realiza diagnóstico de lectura; POST crea un enlace de consentimiento del propietario. Ambos requieren la autenticación administrativa. Los enlaces se conservan únicamente en el artefacto autenticado; los registros públicos exponen solo estado/código/conteos.

La revisión de PR #166 encontró que las filas de plataforma no tenían consumidor porque deliberadamente no poseen un Lead ID. Se añade un consumidor en RSI-01 que revisa hasta cinco snapshots guardados, comprueba fuente, identidad, vigencia y necesidad publicada, y verifica la escritura de un paquete durable `PLATFORM_CONTACT_REVIEW_REQUIRED` o `PLATFORM_RESEARCH_INVALID`. Esto no confirma comprador ni elegibilidad actual para postular; mantiene el canal de origen y la ausencia de envío. No añade otro agente, calendario ni Leads artificiales.

Evidencia productiva previa: main `1cd46dae35fc47f546e32ab73b89202e75b0e281`, despliegue READY `dpl_DZmhPaRUfsh7Uygzvgisxtmq6YSP`, Actions `39272572544`: n8n observó y almacenó cinco publicaciones; Upwork aún bloqueado por falta de OAuth de ejecutor. La preparación quedó 0/5 con `APOLLO_SAVED_ACCOUNT_REVIEW_REQUIRED` y `SOURCE_EXHAUSTED_BEFORE_FIVE`; envío omitido. No declarar lista la campaña sin resolver esa puerta.

Criterio de aceptación de la conexión: diagnóstico del servidor `OBSERVED` y `accountVerified=true`, búsqueda real y recibo del mismo commit. Token creado, conector adjunto y tests simulados no lo sustituyen. Para el consumidor: transiciones verificadas de las cinco filas reales sin promoción a Leads. La desconexión se recupera completando el consentimiento o corrigiendo el cliente OAuth; nunca copiando tokens del chat o del navegador.

Referencias: https://www.upwork.com/ai/mcp · https://community.n8n.io/c/jobs/13 · https://docs.n8n.io/connect/connect-to-n8n-mcp-server

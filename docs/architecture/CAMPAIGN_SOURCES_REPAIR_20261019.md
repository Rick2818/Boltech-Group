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
| Upwork | Adaptador de lectura del MCP oficial `https://mcp.upwork.com/mcp` | OAuth del ejecutor en `UPWORK_MCP_ACCESS_TOKEN`; cuenta `TALENT` comprobada y `find_jobs`. La sesión del complemento de ChatGPT no se copia al servidor |
| n8n Cloud | No certificado | URL de instancia activa y autorización MCP. La URL anterior devolvió «No instance here» y la consola presenta verificación humana |

El MCP oficial de Upwork usa OAuth 2.1 y registro dinámico, por lo que no hace falta solicitar una clave propia para usar el complemento oficial. La callback API previa se conserva; no se confunde con conexión MCP. El adaptador servidor no inventa un token ni toma credenciales del navegador. No ofrece renovación autónoma de OAuth todavía; ausencia o expiración queda como bloqueo visible y n8n continúa independientemente.

n8n Jobs y n8n Cloud son conexiones distintas. La lectura pública no exige contraseña y no certifica acceso a la instancia. El adaptador ignora anuncios de proveedores, solicitudes antiguas/cerradas y respuestas de otros freelancers. Solo registra investigación en la tabla Work existente, deduplica por plataforma/ID, verifica el recibo y nunca inventa correos ni envía propuestas. La cola de correo mantiene intacta su validación de cinco contactos completos. No se fabrican cinco correos a partir de publicaciones.

## Recuperación y controles

Fallos temporales de lectura/investigación pueden reintentarse hasta tres veces por día con cinco minutos de separación. Historial Gmail/Apollo, bajas y rechazos permanentes no se borran ni se eluden. Inventario agotado indica faltantes, responsable RSI-01 y necesidad de reemplazos. Wompi, tarifas, pagos y oferta no cambian.

## Verificación y evidencia

- Línea base: Actions `39150654216`, job `117743435161`, falló con `SOURCE_EXHAUSTED_BEFORE_FIVE`, cero seleccionados y rechazos `APOLLO_SAVED_ACCOUNT_REVIEW_REQUIRED`.
- Upwork: complemento autorizado respondió para la cuenta Ricardo Bolanos, Freelancer, y devolvió cinco publicaciones sobre n8n mediante lectura. Esto acredita el complemento, no OAuth del servidor ni elegibilidad para postular.
- n8n Community: lectura real devolvió cinco solicitudes; IDs `322466`, `319256`, `321244`, `317002`, `315672`. `verifiedBusinessLeads=0`, `sendingEnabled=false`.
- Pruebas locales iniciales: 73 aprobadas, cero fallos, incluyendo límites, duplicados, ventanas, recuperación, fuente caída, escritura no confirmada, canales y ausencia OAuth. La verificación de producción se documenta tras publicar.

Rollback: revertir únicamente los archivos de esta corrección mediante commit. Conservar ledger de envío, historial, registros ya creados y bloqueos; no borrar datos para repetir campañas. El criterio final exige recibo productivo del agente con fuentes observadas y readback de los cinco contactos antes de considerar lista una campaña.

Referencias: https://www.upwork.com/ai/mcp · https://community.n8n.io/c/jobs/13 · https://docs.n8n.io/connect/connect-to-n8n-mcp-server

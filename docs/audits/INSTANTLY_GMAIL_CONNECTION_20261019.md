# Conexión Gmail empresarial con Instantly — 19 octubre 2026

## Resultado y alcance

**Estado: cuenta conectada, remitente asignado y prueba SMTP real recibida en Gmail. Sincronización de respuestas en Unibox aún no certificada.**

Solicitud de Ricardo: conectar únicamente `ricardo.boltechgroup@gmail.com` al AI Sales Agent existente de Boltech Group, probar la conexión y mantener campañas detenidas. Registrar resultados en `main`. No conectar Gmail personal ni modificar Wompi.

Responsable de la ejecución: ChatGPT Work, asistido por Ricardo para introducir la contraseña de aplicación directamente en Instantly. No se leyó, exportó ni guardó la contraseña en este repositorio.

## Decisiones y recursos

- Se intentó primero OAuth desde el flujo oficial de Instantly. Google devolvió **“Se bloqueó esta app”**. No se eludió el bloqueo.
- Instantly ofrece la conexión Google mediante App Password para Gmail. Ricardo completó la conexión con la contraseña generada en Google.
- Se verificó una única cuenta remitente conectada: `ricardo.boltechgroup@gmail.com`, tipo Google, estado **Active**. No se creó una cuenta duplicada.
- Se reutilizó el agente existente **Boltech Group - SMB Operations AI Sales Agent**, ID `01a1565e-6ebc-78a0-9a43-e0c58ef2baef`.
- En **Settings → Accounts to use** se seleccionó únicamente el Gmail empresarial. La selección persistió tras recargar la página.
- El agente se mantuvo **Paused**. Autopilot se observó desactivado.
- La interfaz Google App Password no expone campos manuales para puertos SMTP/IMAP. No se afirma haber verificado manualmente 465/993. La evidencia del mensaje sí demuestra autenticación contra `smtp.gmail.com` mediante TLS.
- No se alteraron variables Vercel, tokens OAuth de Boltech, Wompi ni ejecutores. Esta conexión externa no demuestra por sí sola integración del backend Boltech con Instantly.

## Prueba real de envío y recepción en Gmail

Para probar sin iniciar prospección, se creó un borrador sin leads:
- Nombre: **QA Gmail Boltech - prueba de conexion - NO ACTIVAR**.
- ID: `d933dc7a-0ac6-4cc1-9f4c-99e926f39ae4`.
- Estado: **Draft**; no se pulsó Launch.
- Se utilizó exclusivamente **Preview → Send Test Email**.
- Remitente y destinatario: `ricardo.boltechgroup@gmail.com`.
- Asunto: **QA BOLTECH INSTANTLY 20261019 - Prueba de conexion**.
- Contenido: prueba interna de conexión, sin oferta ni contacto a prospectos.

Recibo leído directamente mediante la conexión Gmail empresarial:
- Fecha UTC: `2026-10-20T01:05:25Z` (19 octubre 2026, 19:05:25 en El Salvador).
- Gmail message ID / thread ID: `1a156d78158e79a3`.
- RFC Message-ID: `<01a156d7-7e4b-7f0c-a666-25f3e7182941@gmail.com>`.
- Etiquetas observadas: **SENT, INBOX, UNREAD**.
- Cabecera Received: entrega autenticada **ESMTPSA** por `smtp.gmail.com`, **TLS 1.3**.
- Se verificaron remitente, destinatario, asunto y cuerpo.

| Comprobación | Resultado |
| --- | --- |
| Una única cuenta empresarial conectada | PASS |
| Gmail personal excluido | PASS |
| Remitente asignado al agente y persistido | PASS |
| Autenticación SMTP real desde Instantly | PASS |
| Mensaje recibido en el Gmail empresarial | PASS |
| Agente en pausa y borrador no lanzado | PASS |
| Lectura de una respuesta por Instantly/Unibox mediante IMAP | PENDIENTE |

## Límite de la verificación y próximo paso

Unibox se observó vacío tanto en la vista principal como en **More → Others** después de la prueba. El envío de prueba recibido en Gmail **no prueba** que Instantly haya leído o vinculado una respuesta de cliente. No se declara IMAP ni el ciclo comercial completo certificados por el indicador Active.

Siguiente criterio de aceptación: observar en Unibox una respuesta controlada al hilo de prueba y comprobar que conserva el remitente y la vinculación correctos. Responsable: ChatGPT Work. Mantener el agente pausado y el borrador sin lanzar mientras esa comprobación siga pendiente. No enviar campañas a prospectos para resolver esta prueba.

La prueba interna no cuenta como lead, oportunidad, venta ni pago. No acredita autonomía comercial ni disponibilidad de créditos, suscripción o entregabilidad a terceros.

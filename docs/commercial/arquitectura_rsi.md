# Arquitectura RSI de Boltech — principio a fin
Fecha: 2 octubre 2026. Objetivo: primer cobro real y repetición rentable.
Implementación: buildRsiArchitecture en lib/commercial_strategy.js; observación y decisiones en el control existente de 09:00, con artefacto diario. Es un coordinador de medición y recomendaciones; no un ejecutor autónomo de campañas ni un aprovisionador DOTS.

## Responsabilidades y contratos de transferencia
| Control | Entradas | Trabajo | Salida y destino |
|---|---|---|---|
| RSI-01 Apollo | Campaña e historial, CRM, ICP y decisor | Validar elegibilidad y evitar contactos repetidos | Oportunidad comercial; si se elige auditoría, candidatura para RSI-02 |
| RSI-02 auditoría | Cuenta elegible o referido genuino, aceptación de auditoría | Diagnóstico autorizado, informe y piloto acotado | Propuesta con alcance/costo para RSI-03 |
| RSI-03 A2A/costos/cobro | Socio, acuerdo, consentimiento, propuesta, costos, pago proveedor | Referidos conjuntos, economía y verificación de cobro/entrega | Aprendizaje para RSI-01; referidos que necesitan diagnóstico a RSI-02 |

RSI-01 y RSI-02 son dos ofertas comerciales diferenciadas, no dos secuencias simultáneas para una misma cuenta. Antes de transferir, registrar motivo, responsable, siguiente acción y estado previo; revisar historial Apollo y CRM. Conservar origen/socio para atribución.
No crear nuevas oportunidades por volver a observar la misma cuenta. El reporte no inscribe ni cambia contactos automáticamente.

## Flujo operativo y fuentes
1. Observar: campaña habitual y campaña de auditoría en Apollo; cohortes RSI-01/02 en Leads; socios y referidos; costos mensuales; pagos confirmados.
2. Decidir: identificar datos faltantes, interés genuino y oportunidad próxima al cobro; emitir una acción por RSI.
3. Actuar: ejecutar solo la acción autorizada y registrar prueba del proveedor o del cliente. Un mensaje preparado no cuenta como enviado.
4. Medir: comparar respuesta, auditoría, propuesta, cobro y entrega con la línea base. No restar cobros históricos de costos mensuales para declarar utilidad.
5. Ajustar: conservar o cambiar una variable; devolver aprendizaje al siguiente ciclo. No modificar código, precios o contratos automáticamente por puntuación.

Estado compartido: Airtable privado para oportunidades, actividades, referidos, costos y pagos. Git versiona políticas y código; Actions conserva reportes agregados. DOTS, si se configura, debe consultar estas fuentes y no depender de memoria conversacional como ledger.
El calendario de 09:00 no implica acciones autónomas a las 09:15 o 11:00. Cada transferencia comercial exige ejecución y evidencia.

## Estados del coordinador
WAITING_DATA: falta lectura verificable. DRAFT_REVIEW: campaña de auditoría existe pero no está activa. WAITING_COST_EVIDENCE: inventario incompleto. MEASURED: fuente disponible; no significa venta, socio aprobado o auditoría terminada.
Estados de tres controladores y cuatro transferencias quedan en commercial.architecture del JSON diario.

## Campañas vinculadas
- RSI-01: Boltech | Customer Requests | Oct 2026 | EN. ID 6abea3c24b681c000c082c9f. Activa, observada el 2 octubre: 23 entregas, 0 respuestas, 0 rebotes.
- RSI-02: Boltech | Free Response Audit | RSI-02 | Oct 2026 | EN. ID 6ac078f9ce5b500010a45968. Creada inactiva, sin contactos inscritos. Tres mensajes: invitación, aclaración del diagnóstico a los tres días y cierre a los tres días siguientes. Mensajes pendientes de revisión; sin consumo de apertura IA.
La activación requiere remitente, horario, contenido y destinatarios concretos revisados; no reutilizar contactos de RSI-01 sin revisar historial y definir nueva oferta.

## DOTS de ChatGPT: configuración pendiente
Documentación oficial consultada: https://learn.chatgpt.com/docs/dots y https://learn.chatgpt.com/docs/dots/getting-started.
La disponibilidad documentada incluye Pro 100/200/500, Business Premium y Enterprise, con despliegue gradual. Plus no figura. La creación se inicia desde escritorio. No se verificó el plan actual de Ricardo ni hay herramienta DOTS de administración en esta sesión.
La documentación permite varias responsabilidades por dot, pero no establece aquí que la cuenta pueda crear tres dots. No se crean bots, cron o tareas programadas para presentarlos como DOTS.
Preparar tres responsabilidades, una por RSI, para asignarlas al dot disponible o a tres si la cuenta lo permite:

### Responsabilidad RSI-01
Gestiona adquisición Apollo para Boltech. Consulta campaña e historial actuales y CRM; valida ICP, decisor y exclusiones; prioriza interés real. Una cuenta conserva una oferta principal. Entrega candidaturas de auditoría a RSI-02 con evidencia y devuelve al CRM responsable/próximo paso. Conserva autorización comercial existente; no amplíes gastos. Éxito final: cobro proveedor, no inventario.

### Responsabilidad RSI-02
Gestiona auditorías gratuitas aceptadas. Usa registros compartidos o pruebas acordadas; no inventes compras o fallas. Separa primera respuesta automática de respuesta útil; informa muestra y límites. Prepara informe y piloto pagado de un canal/proceso; entrega alcance, costo y aceptación a RSI-03. No actives campañas ni comprometas precio sin los acuerdos necesarios.

### Responsabilidad RSI-03
Coordina socios A2A, costos y cobro. No actives candidatos como socios sin acuerdo y validación. Excluye QA, conserva consentimiento y atribución. Completa costos con evidencia; si faltan datos, margen N/D. Reconoce cobro solo con proveedor; calcula comisión conforme al acuerdo. Devuelve aprendizaje a RSI-01 y referidos elegibles a RSI-02. Prioriza primer cobro y repetición rentable.

## Aceptación y límites
Pruebas deben cubrir tres controladores, transferencias explícitas, borrador distinto de campaña activa, falta de datos, costos no comprobados y QA excluido. El control debe ejecutarse después del despliegue para verificar esquema nuevo.
Dependencias externas pendientes: DOTS elegible/configurado, facturas y consumos comprobados, socios comerciales acordados, prospectos que acepten auditoría y pago genuino completo. No declarar funcionamiento comercial al 100% solo por CI verde.

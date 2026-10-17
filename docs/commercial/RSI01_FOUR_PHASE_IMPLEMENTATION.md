# Plan y ejecución comercial RSI-01 (2026-10-17)

## Objetivo
Cinco oportunidades justificadas por día, sin fabricar señales ni exigir respuesta previa antes del primer contacto **autorizado**.

## Fase 1 — Descubrimiento
El ciclo RSI-01 examina Leads del CRM y genera un trabajo para empresas con URL HTTPS cuyo dominio corresponde al correo empresarial, sin tarea previa, respetando bajas/exclusiones. Límite: cinco nuevas tareas por ciclo. Aún NO descubre empresas ajenas al CRM ni consume motores de búsqueda externos; necesitará proveedor/índice autorizado con cobertura comprobada.

## Fase 2 — Investigación
El investigador inspecciona la portada y hasta tres subpáginas del mismo dominio; extrae URL, fragmento y categoría de señal operacional. No infiere dolor confirmado. Procesa hasta cinco casos por ciclo, priorizando sitios verificables. Casos retry pueden volver a investigarse sin duplicación durante un mismo día.

## Fase 3 — Preparación para ventas
Cada valoración produce `reviewPacket` con señales documentadas, comprador/ contacto presentes, necesidad confirmada solo si cliente la afirmó, y estado REVIEW_REQUIRED/INSUFFICIENT_EVIDENCE. Es un expediente **no aprobado** en RSI Agent Work. No crea `SDR_CANDIDATE_V1` con READY_FOR_CONTACT, no activa correo y conserva el proceso de revisión individual existente. El sistema no inventa autorización.

## Fase 4 — Ejecución
Utiliza el workflow GitHub Actions existente y endpoint Vercel; registra `RSI01_CRM_DISCOVERY` y `RSI01_RESEARCH_ASSESSMENT` con conteos. El ledger Redis del día no debe reiniciar envíos ni duplicar trabajos. Que la campaña retorne NO_APPROVED_LEADS significa falta de contactos autorizados, no que falle la búsqueda técnica. Revisar siempre ambos recibos por separado.

## Aceptación productiva
Requiere workflow aprobado, Vercel READY con SHA correcto y un recibo real de Agent 1 mostrando fuentes obtenidas. Si no hay cinco oportunidades justificadas, reportar número real y razón. Wompi y envíos comerciales intactos.

## Registro Harness — RFI UNC Greensboro, 17 octubre 2026

**Airtable:** `recXGZ8gZCjvY2uHB`; `RSI01:PUBLIC_RFI:69-MFL0002`; estado `ORG_VERIFIED_RFI_ONLY`.

- Organización: University of North Carolina Greensboro (Estados Unidos).
- Solicitud pública registrada: `69-MFL0002` (RFI). Fuente: https://evp.nc.gov/solicitations//details/?id=19309bc4-65c9-f111-aaae-001dd80bcb64
- Fechas registradas (pendientes de reconfirmar antes de responder): publicada 2026-10-16, cierre 2026-11-06.
- Objeto: consulta institucional sobre chatbot de IA; necesidades de integración, privacidad y accesibilidad requieren lectura de pliego oficial.
- Evidencia real: Airtable contiene el expediente con fuente, número, organización y tarea; el último ciclo RSI-01 probado terminó `COMPLETED`, `rsi01_case_research_executor=VERIFIED` y `failed=0`. **No es una certificación de investigación de este RFI particular**, ni implica elegibilidad, propuesta enviada o venta.
- Sin confirmar: comprador y email corporativo, pliego completo, registro de proveedor, exigencias técnicas y cumplimiento de Boltech, valor de contrato, compromiso de compra.
- Estado de contacto: `purchaseCommitted=false`, `approvedForOutreach=false`, `sendingEnabled=false`.
- **Próxima tarea Agent 1:** validar portal y documentos, elegibilidad y plazo; matriz de requerimientos/capacidades/brechas/coste; determinar canal institucional oficial. Someter a aprobación humana antes de envío.
- Las cinco publicaciones previas de foros solo proporcionan inteligencia de mercado: no son compradores verificados.

**Certificación:** evidencia documental del expediente **sí**; elegibilidad técnica/comercial **pendiente**; contacto o venta **no**.

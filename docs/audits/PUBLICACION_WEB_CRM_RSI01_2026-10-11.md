# Publicación web, CRM y RSI-01 — 11 octubre 2026

## Revisión de producción 24 octubre 2026, 08:00 SV

Revisión visual de solo lectura en https://boltech-group.vercel.app/ confirmó el formulario público y contenido actual en español. La página ofrece “Prueba con alcance definido” por US$600 (US$300 + US$300) y agentes generales por US$900. Esto contradice la oferta vigente aprobada en `config/commercial_pilot.json` y `docs/commercial/OFERTA_UNICA_PILOTO.md`: piloto de USD990, hitos USD495/USD495, 14 días, un negocio/un flujo web/una integración sencilla. No se editó ni envió el formulario y no se cambió el contenido publicado.

La URL directa de despliegue previamente indicada (`https://boltech-group-jfjjnjvtt-rick2818s-projects.vercel.app/`) responde 410 GONE y dice que el deployment fue eliminado por retención. El dominio público sí sigue sirviendo otro contenido, así que no se promovió ni redesplegó ningún build a ciegas. En esta sesión `vercel whoami` terminó con `Worker timed out after 10 seconds`; el panel de Vercel abrió en Login sin sesión y no hay conector Vercel disponible. Se requiere restablecer una sesión Vercel autenticada para identificar el deployment que posee el alias y publicar una corrección sin sustituir cambios concurrentes. No se pidió ni aceptó permiso nuevo, no hubo cobros, contactos o escrituras CRM.

La lectura confirma que el alias está activo, no que lo sirva el commit esperado: tanto el archivo del worktree como `origin/main:index.html` contienen el precio aprobado USD990/USD495, no el contenido US$600 observado. El chequeo de sitio solo muestra precios; falta determinar el build origen mediante el panel autenticado. La batería offline previa fue 21/21 con `config/qa_case.json`; no se repitió. Correcciones locales de intake/relectura y revisión individual BLIA/Apollo siguen sin publicar; quedan pendientes publicación desde una fuente reconciliada, recibo cloud del consumidor RSI-01 y completar el readback de producción con duplicación segura. La cadena técnica y la venta real no se declaran cerradas.

## Integridad local 13 octubre, 19:39 SV

En esta copia aparecieron eliminaciones de medios versionados (logo institucional, videos y audio) que no pertenecen a las correcciones realizadas aquí. No se restauraron ni se incluyeron en staging; preservar trabajo concurrente y revisar origen antes de desplegar desde este árbol. La aprobación Git sigue sin recibo de ejecución. Fuera del horario comercial: sin cambios a leads, contactos ni cobros. Este hallazgo no acredita un fallo del sitio publicado y no se redesplegó.

## Bloqueo de publicación confirmado 13 octubre, 15:48 SV

Los cambios continúan sin staging. El intento previo de git add falló con Permission denied al crear .git/worktrees/web-crm-publicacion-20261011/index.lock. La solicitud de ejecución con elevación devolvió aborted; no hubo confirmación de ejecución ni se interpreta como aprobación. Se conserva todo el trabajo local y evidencia privada ops-output sin publicar. Para continuar commit/push de esta rama hace falta permitir escritura Git de su índice mediante la aprobación del comando; no modificar permisos globales ni main. Última batería pertinente: 21/21 offline aprobadas, sin nueva ejecución repetida en este ciclo. No se afirma cierre técnico.

## Exclusión de despacho 13 octubre, 10:57 SV

Revisión detectó que el dispatcher BLIA no tenía exclusión explícita del único QA. Se añadió rechazo QA_EXTERNAL_CONTACT_FORBIDDEN por requestId, leadId o correo normalizado antes de consultar/escribir ledger o Gmail. Pruebas actualizadas: 21/21 offline aprobadas; el QA con todas las aprobaciones sigue rechazado con cero llamadas de transporte. Esta batería sustituye las dos antiguas simulaciones de envío/recibo, que no deben usarse como evidencia comercial. Sigue pendiente verificar los otros controles de despacho con evidencia permitida; no se habilitó el envío. El consumidor de investigación ahora puede leer tareas aunque falle una etapa previa, sin habilitar despacho tras el fallo. Diff sin errores de espacios. Cola Dirección vacía. Cambios locales, publicación y comprobación cloud pendientes.

## Adaptación de pruebas 13 octubre, 08:14 SV

Se adaptaron los cinco archivos de pruebas del workflow BLIA al identificador/correo del único config/qa_case.json, manteniendo variaciones inválidas del mismo caso. El mock de intake ahora confirma GET posterior por recordId; no basta el POST. Se añadieron las regresiones de relectura y consumidor al comando del workflow existente. Resultado: 23/23 pruebas offline aprobadas, sin red, registros CRM, mensajes ni cobros reales. Continúan pendientes revisión/publicación y comprobación del recibo del consumidor cloud; los cambios permanecen en este worktree y main sigue intacto.

## Corrección local 12 octubre, 16:01 SV

Añadido scripts/rsi01-research-work-consumer.cjs al workflow existente: lee páginas completas de RSI Agent Work y produce recibo privado individual de tareas BLIA/Apollo con recordId, Work ID, Source Record ID, propietario y etapa actuales. Rechaza identidades duplicadas, datos incompletos y cursores repetidos; no muta CRM ni habilita envíos. Excluye el único QA y conserva tareas reasignadas/avanzadas. Una revisión BLOCKED_RESEARCH sigue necesitando investigación real; el recibo no significa calificación ni contacto.

Seis regresiones offline aprobadas (tres de intake y tres del consumidor), todas basadas en config/qa_case.json y transporte simulado sin red. La integración sigue local: falta adaptar pruebas heredadas del workflow, verificar consumidor en ejecución cloud, coordinar escrituras inciertas y publicar/verificar correcciones. No se ejecutó adquisición ni se declara cierre técnico o comercial. Main sin modificar.

## Relectura independiente 12 octubre, 15:11 SV

Conector Airtable actual respondió a schema y dos lecturas filtradas del único QA. Leads: exactamente un registro recnSzDjCRebpwwWf, Data Quality=QA, Commercial Stage=Researching. Work: exactamente una tarea recZoi8Ow3JintGUH, Work ID WEB_INTAKE:baefaac4b82778f069cbb89291c1a2071e6af5103373890abc66eb5d792aa2e3, Source Record ID=recnSzDjCRebpwwWf, propietario actual RSI-01 — responsable diario de ventas, estado PENDING_RSI01_RESEARCH. La evidencia conserva emailVerified=false, customerAcceptance=false y paymentVerified=false. Se confirma relación y deduplicación del caso web sin crear registros ni enviar mensajes. Snapshot privado: ops-output/qa-independent-crm-readback-20261012.json. Contexto: heartbeat, consultas por conector; no acredita disponibilidad permanente de otro ejecutor.

Cola cloud de Dirección sin pendientes. Se consultaron las reglas y CORRECCIONES_EN_SEGUNDO_PLANO.md desde la raíz principal en modo lectura porque este último documento no existe en esta copia. Sigue pendiente completar consumo verificable BLIA/Apollo, coordinación de escrituras y publicación de las correcciones locales; la relectura QA no prueba una venta ni cierre integral. No se modificó main.

## Continuación comprobada 12 octubre, 10:02 SV

Apollo intake corregido localmente: tabla RSI Agent Work por ID, rechazo de Work ID duplicado y relectura por recordId tanto para coincidencias como para nuevas altas; comprueba Work ID y Source Record ID antes de contabilizar el resultado. Conserva propietario y etapa existentes. Sintaxis validada. BLIA: 3/3 regresiones offline aprobadas con el único config/qa_case.json, incluyendo POST confirmado seguido de relectura incompatible: falla sin repetir POST. No se ejecutó adquisición ni contacto externo.

Cola cloud consultada en este ciclo: success=true, pending=[], commercialSaleInferred=false. Revisión del workflow existente: el preparador RSI-01 consume el archivo handoff, no las tareas actuales de Airtable ni el recibo individual de Apollo; persiste pendiente el vínculo de consumo verificable. El workflow todavía referencia pruebas BLIA heredadas: no ejecutarlas hasta adaptar fixtures al caso único. Persisten también coordinación de escrituras/resultado incierto y verificación independiente CRM. Estos cambios siguen locales y no acreditan despliegue, cierre técnico ni pago. Trabajo exclusivamente en .worktrees/codex/web-crm-publicacion-20261011; main sin modificar.
## Continuación comprobada 12 octubre, 09:29 SV

Se recuperó el recibo del navegador del 12 octubre 00:04:55 UTC: PASS, API 200, requestId del único QA, assignment RSI-01/PENDING_RSI01_RESEARCH, QA_EXCLUDED y duplicateReferenceConfirmed=true. Evidencia privada en ops-output/web-reception-production-verification.json y captura PNG. El despliegue dpl_3HxNwL3iBB8uc8VmuEK6Eew4fuZT se confirmó READY con alias boltech-group.vercel.app y commit 7e064e5; no se necesitó otro despliegue. La prueba comprueba el recibo público, no una nueva relectura independiente por conector ni un cliente real.

Corrección local de BLIA intake: tabla por ID, rechazo de Work ID ambiguo y GET por recordId después de creación o coincidencia existente; confirma Work ID/Source Record ID y devuelve owner/status actuales sin sobrescribirlos. Dos regresiones offline con config/qa_case.json aprobadas. No se ejecutaron pruebas heredadas BLIA ni adquisición. Cambio todavía sin publicar. Pendiente: consumo individual verificable por RSI-01, equivalencia Apollo, relectura independiente de CRM y revisión antes de integrar. Cola Dirección vacía. No se declara cierre completo ni pago.

Autorización: Ricardo pidió integrar/publicar web, comprobar CRM y asignación, vincular agente de leads con RSI-01 y completar en segundo plano sin informes rutinarios.

Trabajo aislado: .worktrees/codex/web-crm-publicacion-20261011, rama codex/web-crm-publicacion-20261011. No se modificó main.

Se integraron las correcciones web/API/CRM/RSI desde el checkout principal. Se integró origin/main 04adbcf para conservar la conexión y selección reciente de Apollo. Commit integrado 7e064e53718af9f2f1022293de99842075f72667 publicado en la rama remota.

Verificación: 163 módulos con sintaxis válida; 34 pruebas web/intake/ejecutor aprobadas con caso único QA. Una ejecución adicional incluyó 6 pruebas heredadas BLIA con fixtures antiguos; no produjo contactos/registros externos, pero esos fixtures deben adaptarse al único caso autorizado antes de repetirlos. No se certifica autonomía comercial por esas pruebas.

Despliegue de producción solicitado por conector Vercel autenticado: dpl_3HxNwL3iBB8uc8VmuEK6Eew4fuZT, proyecto prj_rDXc2BJOAgpLtnHTEgmTJ3XaY9AI, equipo team_b4i7mjM6diaFho1nysCnHzUl. Último estado BUILDING; no declarar READY ni dominio actualizado sin nueva comprobación.

La CLI Vercel inició sin sesión y posteriormente confirmó rick2818 autenticado. El despliegue se solicitó mediante el conector ya autenticado. No se expusieron credenciales.

Continuación obligatoria: confirmar deployment READY y alias boltech-group.vercel.app; comprobar mediante navegador el único caso config/qa_case.json y relectura CRM/tarea; confirmar deduplicación y propietario actual. Revisar scripts/apollo-rsi01-daily-intake.mjs, scripts/rsi01-airtable-intake.cjs y .github/workflows/blia01-discovery.yml: tareas de investigación existen, pero faltan garantías de relectura y consumo verificable del caso individual por RSI-01. No confundir tareas RESEARCH_REQUIRED con compradores calificados ni envío automático habilitado.

La automatización existente revisar-bloqueos-de-agentes-de-ventas fue actualizada conservando horario, chat, restricciones y prompt anterior, con prioridad expresa sobre estas correcciones. ACTIVE, cada hora, sin automatización nueva. Comunicar solo cierre integrado o intervención indispensable.

## Campaña manual 16 octubre 2026, 09:06 SV
Por solicitud expresa de Ricardo se disparó una sola ejecución workflow_dispatch 38921060334, commit remoto c30fd773d23aae57b3f98590a2a9be086ffcac46. Job 117040785489 terminó success, pero recibo RSI indica ATTENTION: RSI-01/02/03 BLOCKED, Gmail OAuth GMAIL_OAUTH_AUTH_FAILED. Campaña: reviewed=226, eligible=0, approvedTotal=0, pendingApproval=226, cycleStatus=NO_APPROVED_LEADS, results=[]. Cero envíos de esta ejecución. El runner deja exit 0 cuando success=true aunque outcome=BLOCKED; por eso verde GitHub no acredita operación comercial. No reintentar despacho sin resolver historial OAuth y elegibilidad. El trigger programado de hoy aún no constaba antes del manual; causa del retraso no confirmada.


## Conciliación de buzón 16 octubre, 11:58 SV
Conector Gmail comercial volvió a responder en esta sesión: consulta in:sent después de 15:00 UTC devolvió un mensaje, sin página siguiente. ID 1a14582fd3ee1eb0, thread igual, destinatario sales@marstrand.us, asunto Question about incomplete fabrication quote requests, fecha 16:19:34 UTC (10:19:34 SV). Es un envío real observado posterior al ciclo manual; origen/claim/CRM todavía no conciliados. No atribuirlo al workflow 38921060334 ni reenviar. Recuperación del conector interactivo no demuestra recuperación OAuth de Vercel. Dirección pending vacío. Sin aviso repetido ni afirmación de venta.

## Relectura de intake y vínculo RSI-01 — 26 octubre 2026, 09:12 SV

Se leyeron todas las páginas actuales de Leads y RSI Agent Work mediante Airtable: 267 leads y 290 tareas. El plan inicial detectó 28 tareas faltantes; la relectura halló una ficha histórica llamada “CLIENTE SINTÉTICO … NO VENTA” mal clasificada como RESEARCH_ONLY. Se corrigió el planificador para excluir esos registros aunque el select de calidad derive, se restauró `scripts/ops/plan_lead_intake.mjs` en esta copia y se regeneró el plan: 27 tareas nuevas, 233 cubiertas y 7 excluidas. La única QA configurada y las seis exclusiones restantes no se encolaron.

Las 27 tareas LEAD_INTAKE se upsertearon por Work ID y se releyeron de Airtable; los 27 Source Record ID, RSI-01, owner y estado coinciden con el plan. No se modificaron leads ni se enviaron mensajes o pagos. Se amplió el consumidor de investigación RSI-01 para leer también LEAD_INTAKE sin cambiar propietarios/etapas ni habilitar despacho. La suite adaptada del workflow pasó 21/21 pruebas con solo `config/qa_case.json`; una comprobación adicional excluyó la variación de clasificación errónea de esta misma QA en el planificador. Evidencia privada: `ops-output/heartbeat-intake-readback-20261026T1510Z.json`, `ops-output/heartbeat-intake-plan-20261026-1458Z.json` y `scratch/commercial-scale/daily-2026-10-26.json`.

El consumidor cloud no se ejecutó: el workflow existente también contiene una ruta opcional de despacho Gmail que no se debe disparar sin verificar el estado efectivo de su control. La prueba es local contra una sola QA; no acredita lectura cloud ni autonomía. Continúa pendiente publicar correcciones de esta rama y verificar el alias público/despliegue y la lectura visual con QA. No se declara cierre técnico ni ingreso comercial.


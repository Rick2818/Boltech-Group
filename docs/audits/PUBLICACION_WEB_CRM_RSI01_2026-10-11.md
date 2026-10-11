# Publicación web, CRM y RSI-01 — 11 octubre 2026

Autorización: Ricardo pidió integrar/publicar web, comprobar CRM y asignación, vincular agente de leads con RSI-01 y completar en segundo plano sin informes rutinarios.

Trabajo aislado: .worktrees/codex/web-crm-publicacion-20261011, rama codex/web-crm-publicacion-20261011. No se modificó main.

Se integraron las correcciones web/API/CRM/RSI desde el checkout principal. Se integró origin/main 04adbcf para conservar la conexión y selección reciente de Apollo. Commit integrado 7e064e53718af9f2f1022293de99842075f72667 publicado en la rama remota.

Verificación: 163 módulos con sintaxis válida; 34 pruebas web/intake/ejecutor aprobadas con caso único QA. Una ejecución adicional incluyó 6 pruebas heredadas BLIA con fixtures antiguos; no produjo contactos/registros externos, pero esos fixtures deben adaptarse al único caso autorizado antes de repetirlos. No se certifica autonomía comercial por esas pruebas.

Despliegue de producción solicitado por conector Vercel autenticado: dpl_3HxNwL3iBB8uc8VmuEK6Eew4fuZT, proyecto prj_rDXc2BJOAgpLtnHTEgmTJ3XaY9AI, equipo team_b4i7mjM6diaFho1nysCnHzUl. Último estado BUILDING; no declarar READY ni dominio actualizado sin nueva comprobación.

La CLI Vercel inició sin sesión y posteriormente confirmó rick2818 autenticado. El despliegue se solicitó mediante el conector ya autenticado. No se expusieron credenciales.

Continuación obligatoria: confirmar deployment READY y alias boltech-group.vercel.app; comprobar mediante navegador el único caso config/qa_case.json y relectura CRM/tarea; confirmar deduplicación y propietario actual. Revisar scripts/apollo-rsi01-daily-intake.mjs, scripts/rsi01-airtable-intake.cjs y .github/workflows/blia01-discovery.yml: tareas de investigación existen, pero faltan garantías de relectura y consumo verificable del caso individual por RSI-01. No confundir tareas RESEARCH_REQUIRED con compradores calificados ni envío automático habilitado.

La automatización existente revisar-bloqueos-de-agentes-de-ventas fue actualizada conservando horario, chat, restricciones y prompt anterior, con prioridad expresa sobre estas correcciones. ACTIVE, cada hora, sin automatización nueva. Comunicar solo cierre integrado o intervención indispensable.


# Corrección del recorrido comercial — 12 octubre 2026

Plan: (1) restaurar dependencias y verificar ADK; (2) aislar fallos de Mercadeo y conservar su causa; (3) corregir los cuatro materiales existentes con contexto CRM; (4) probar, publicar y releer evidencia productiva. No se crean agentes, horarios, contactos, cotizaciones ni cobros.

`@google/adk` 2.2.1 ya forma parte de package.json y del lockfile. Instalación local con npm ci, sin scripts de instalación ni llamadas a modelos. Las pruebas de ADK y relevos que antes no podían arrancar funcionan tras instalar las dependencias.

Los recibos del 12 octubre a las 12:02 SV mostraban RSI-01/02 BLOCKED y RSI-03 con preparación comercial fallida. El paso común era marketing_material_sales_review. El ejecutor descartaba el código original de la excepción y una revisión fallida interrumpía trabajo independiente. El ciclo corregido registra etapa, evento y código permitido; continúa los demás materiales y relevos. Un fallo permanece visible como BLOCKED; no se convierte en éxito por capturarlo.

La reparación administrativa se limita a cuatro eventos existentes: adk-support-RSI-01/02/03-2026-10-07 y marketing-leadflow-RSI01-20261009. El contenido procede de su cuenta CRM. Conserva versiones anteriores, excluye material utilizado y exige relectura de la versión nueva. LeadFlow recibe preguntas de encaje como proveedor, financiación, herramientas, plazo y portafolio. Los materiales de diagnóstico/cierre mantienen la espera de respuesta y aprobación. Un correo anterior a la nueva versión no acredita uso de esa versión.

La publicación utiliza el workflow RSI Production Acceptance existente, sin calendario adicional. El paso de reparación espera el commit exacto en producción y usa la credencial administrativa que ya existe en GitHub Actions; nunca extrae valores de secretos. Hace un único POST y una relectura; un resultado incierto requiere conciliación. La evidencia sanitizada se guarda como marketing-production-repair.json en el artefacto del workflow. La reparación no envía correos ni activa checkout.

Validación local: suite de 20 archivos comerciales aprobada; regresiones de fallos aislados, reparación idempotente, protección de versiones y rechazo de acceso público. Sintaxis de 165 módulos comprobada antes de publicación. La lectura productiva de la reparación debe verificarse por separado.

Límites comerciales: cero problemas confirmados en los 220 registros CRM revisados; no hay pago comercial en Payment Orders. El pago de USD1 es payment-verification y queda excluido. Costos documentados, respuesta humana, alcance individual y aceptación siguen siendo condiciones reales para el cierre; no se fabrican para eliminar un bloqueo.

El primer intento de publicación se detuvo ante «user rejected MCP tool call» en create_blob; no modificó producción. Ricardo confirmó después que la corrección debe quedar en producción y pidió no utilizar esa herramienta. Se retoma la publicación con un árbol Git de los archivos revisados, commit, PR y despliegue; el resultado de producción se comprueba por separado.

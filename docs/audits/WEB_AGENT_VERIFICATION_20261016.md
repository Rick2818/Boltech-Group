# Verificación del agente web — 16 octubre 2026

## Alcance y evidencia
- Repositorio: Rick2818/Boltech-Group, rama principal consultada el 16 octubre 2026.
- PR #82: https://github.com/Rick2818/Boltech-Group/pull/82 — «Agente web comercial: contrato de 5 preguntas y consentimiento». La descripción declara expresamente documentación, **sin implementación ni certificación de producción**.
- Archivos del PR #82: docs/commercial/WEB_AGENT_5_QUESTIONS_20261015.md, lib/commercial_intake_router.js, tests/test_commercial_intake_router.mjs, además de documentación y pruebas del harness.
- En main, al verificar, esos tres archivos **no se encontraron**. La rama feature/web-agent-five-question-flow-20261015 sigue siendo accesible. No se debe equiparar rama/PR con producción.
- En index.html de main existe una sección identificada como «Asistente de Boltech Group» y etiquetas de consultas. Sin embargo, el comentario del widget flotante no basta para demostrar que ejecuta una entrevista de máximo cinco preguntas, capta WhatsApp/email, registra consentimiento ni transmite una oportunidad a RSI-01.

## Criterios requeridos, no certificados
1. Preguntas dinámicas de un máximo de cinco, ES/EN, sin pedir datos innecesarios.
2. WhatsApp o correo como contacto opcional y consentimiento verificable.
3. Persistencia real de solicitud con opportunityId, fuente, recibo, deduplicación y entrega idempotente a RSI-01.
4. Prueba de Cliente Sintético: captura → consentimiento → CRM → RSI-01 → recibo y recuperación controlada ante fallos.
5. Tests en GitHub Actions aprobados, integración en main, despliegue production READY del commit y prueba HTTP/UI del flujo público.

## Dictamen
**PARCIAL / NO CERTIFICADO EN PRODUCCIÓN**. Está verificada la existencia de la propuesta de cambios y parte de la interfaz preexistente; NO se ha acreditado el recorrido nuevo de punta a punta ni su despliegue productivo. No afirmar cinco preguntas en vivo, traspaso real o autonomía sin evidencia.

## Seguridad y límites
No modificar Wompi, pagos, agentes de ejecución ni funciones comerciales heredadas desde esta auditoría. Ningún correo de prueba debe enviarse a un cliente real; usar «Cliente Sintético» y aislamiento en QA.

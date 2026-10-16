# Harness AutoDoc + Guard — control de cambios
Todo cambio versionado se detecta en GitHub Actions, con un evento JSON por SHA en `docs/harness/events/`. Campos: autor, fecha, resumen, archivos, commit y estados de evidencia. Ningún evento representa prueba, pago, despliegue ni certificación en producción; esos estados permanecen NO VERIFICADOS hasta tener recibos independientes.

**PR:** `harness-autodoc` genera y valida un registro, disponible como artifact del workflow; no escribe en ramas de colaboradores. **Push a main:** intenta confirmar el evento de auditoría en una segunda confirmación del bot, con `[skip ci]` y sin envíos externos. En ramas protegidas el push del bot puede ser rechazado; en ese caso el evento permanece visible en GitHub Actions y la automatización debe habilitarse mediante una excepción limitada o una PR automatizada. No se elimina la protección de ramas para conseguirlo.

**Harness Guard:** la comprobación `harness-autodoc` puede convertirse en required status check de `main`. Hasta configurar esa regla en GitHub, el workflow por sí mismo no bloquea merges. Para documentar cambios en Airtable/Vercel no versionados harán falta adaptadores/eventos separados. Los secretos quedan fuera de estos archivos.

La política no puede garantizar corrección semántica del código: solo genera trazabilidad de cambios; PASS técnico y certificación del cliente requieren verificaciones independientes.

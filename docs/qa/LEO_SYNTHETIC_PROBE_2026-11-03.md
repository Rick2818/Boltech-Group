# Leo — Prueba sintética operacional (QA aislada)

Propósito: comprobar contra producción que el motor autónomo puede guardar un encargo sintético en Redis real, aprobarlo, ejecutar tres pasos read-only, dejar recibos, exigir revisión y limpiar todos los registros de prueba, sin contaminar métricas comerciales.

**No hay clientes reales.** Tenant interno: qa_synthetic_leo; ID de objetivo aleatorio con prefijo qa_. La fuente documental fijada es https://raw.githubusercontent.com/github/docs/main/README.md. No utiliza un LLM, correo, WhatsApp, bids, pagos ni modifica datos de usuarios.

## Ejecución
1. Requiere el token BOLTECH_SCHEDULER_SECRET vigente en Supabase Vault (nunca extraer ni mostrar).
2. Requiere las flags LEO_AUTONOMY_ENABLED=1 y temporalmente LEO_SYNTHETIC_PROBE_ENABLED=1 en el despliegue Vercel.
3. Envía POST interno a /api/leo-autonomy-worker con operación synthetic_probe. El endpoint no acepta tenant, URL, tool ni ID suministrados por el llamador.
4. Crea objetivo, prepara plan y aprueba; ejecuta inspect, source_1, report. Guarda recibos SHA-256 y respeta el tiempo de cola.
5. Exige AWAITING_REVIEW y validación; elimina el objetivo y su miembro de cola en finally.
6. Ante cualquier fallo, informa error y jamás un PASS falso. Las operaciones tienen etiqueta synthetic=true.

## Gates y retirada
- Tests en GitHub Actions: node --test tests/test_leo_synthetic_probe.mjs
- CI/Governance y build con commit exacto.
- Vercel READY con el mismo commit; llamada de Supabase Vault; recibo HTTP 200, status PASS, 3 pasos.
- Desactivar LEO_SYNTHETIC_PROBE_ENABLED terminada la prueba; validar redeploy final.
- Mantener marketing, research, Wompi y métricas sin modificación.

La prueba no certifica provisión de identidad de cliente, conectores OAuth, autonomía cognitiva general ni equivalencia con ChatGPT Dots.

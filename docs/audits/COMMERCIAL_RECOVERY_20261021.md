# Corrección comercial — 21 octubre 2026

Responsable: ejecutor central Boltech. Autorización: Ricardo, corregir fallos y verificar.
Base: main 69d150884c8e0891b0abd3ef1bb22eacc379dd0e.

## Resultado esperado y plan

1. Sustituir los disparadores operativos demorados de GitHub por pg_cron/pg_net en el Supabase existente. Conservar las rutas Vercel y una sola cola; clave dedicada guardada en Vault y entorno productivo. GitHub conserva CI y ejecución manual. Verificar dos invocaciones automáticas, respuesta HTTP y recibo durable.
2. Corregir métricas: investigación/preparación no son seguimientos. Registrar por separado contactos reales y conciliación pendiente. Verificar lectura posterior del CRM.
3. Conciliar los cinco contactos enviados con Gmail y guardar próxima acción, hilo, último mensaje y bloqueo por respuesta/baja/rebote. No inventar cadencia ni enviar seguimientos sin vencimiento documentado.
4. Corregir procesamiento de respuestas: revisar conversación completa, cancelar secuencia ante respuesta/baja, conservar recibos y Message-ID determinista. Un resultado incierto nunca se reenvía automáticamente.
5. Pruebas QA aisladas de concurrencia, duplicados, respuesta/baja, fallo de proveedor y recuperación; compilación y CI; desplegar y verificar SHA, autenticación, respuestas reales y persistencia. Wompi fuera del cambio.

## Evidencia inicial

- Tres avisos Explee: clave mal formada (503) y dos rechazos de autenticación (401); ejecuciones posteriores exitosas, sin contactos interesados importados.
- Ciclo e inbox: 404 anteriores al despliegue de las rutas; ejecuciones posteriores exitosas.
- Ciclos productivos 04:24, 09:32 y 14:40 UTC: brechas de unas cinco horas, aunque YAML dice diez minutos. GitHub documenta demoras y pérdida de eventos schedule.
- CRM: 108 NEW/RESEARCH, 10 NEW/PREPARED, 5 CONTACTED/outreach_sent. El contador 118 sumaba cualquier next_action, incluidos investigadores. Los cinco contactados no tenían próxima acción.
- Supabase Boltech uxwfqhromoicrwzyylbn; Vercel boltech-group en Hobby. No nuevas cuentas ni servicios de pago.

## Verificación y pendientes

En curso. No se certifican continuidad, envío, entrega, venta ni pago a partir de un indicador verde.

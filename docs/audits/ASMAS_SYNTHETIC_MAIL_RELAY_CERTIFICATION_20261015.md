# ASMAS — Harness: prueba de correo sintético y traspaso A1 → A2

Fecha: 2026-10-15 (El Salvador). Alcance: pruebas de lógica de coordinación, no campaña comercial real.

## Evidencias certificadas
- PR #78, fusionado en main: https://github.com/Rick2818/Boltech-Group/pull/78
- Commit de integración: `caff874c153aa95dcd4974ba86ea4c7c272a3fbb`.
- GitHub Actions: https://github.com/Rick2818/Boltech-Group/actions/runs/38765754748
- Resultado: **15 pruebas PASS, 0 FAIL**.
- Prueba 1: un mensaje enviado desde `ricardo.boltechgroup@gmail.com` hacia esa misma cuenta, marcado CLIENTE SINTÉTICO, **no** crea handoff A1 → A2 ni expediente de cierre.
- Prueba 2: una respuesta de comprador **simulada**, verificada en fixture, crea únicamente el handoff A1 → A2 y queda `WAITING_DIRECTOR_APPROVAL`; no implica venta, cobro ni envío real.
- Las pruebas están en `tests/test_commercial_relay.mjs` y enlazadas al workflow `.github/workflows/client_delivery_certification.yml`.
- El correo de prueba real se confirmó en Gmail con messageId `1a1404b7a65c74c0`; su recepción no crea automáticamente una respuesta de un comprador.
- Vercel: despliegue de `main` generado con el commit del PR #78 (comprobar estado READY antes de afirmar producción). Un despliegue READY no acredita que OAuth Gmail de Vercel funcione.

## Criterios Harness, Regla de Oro 1
1. Recuperar evidencia existente y no duplicar envíos de prueba.
2. A1 solo puede transferir a A2 si hay respuesta entrante real de un comprador registrado, identidad/historial verificados, ausencia de exclusiones y evidencia de mensaje. Un correo sintético o enviado por Boltech a sí mismo **debe rechazarse**.
3. A2 documenta diagnóstico y espera autorización individual firmada por Dirección antes de avanzar a A3.
4. A3 no registra cierre sin recibos ni aprobación; ningún test sintético autoriza pagos.
5. Cada prueba CI debe guardar run, SHA, resultado y alcance exacto. GitHub PASS ≠ Gmail OAuth productivo, ≠ funcionamiento autónomo A1–A4, ≠ venta.
6. Cualquier fallo debe producir estado BLOCKED y activar diagnóstico RSI basado en evidencia, sin reenvío incierto.
7. No alterar los prospectos reales, Wompi, secretos ni cron por una prueba de fixture.

## Pendientes fuera del alcance de esta certificación
- Verificación de OAuth con refresh token desde runtime Vercel (se observó GMAIL_OAUTH_AUTH_FAILED previamente).
- Confirmar ejecución comercial completa real con un comprador autorizado, sus recibos y cron de las 09:00 SV.
- Verificar que la versión `main` esté desplegada y READY en Vercel.

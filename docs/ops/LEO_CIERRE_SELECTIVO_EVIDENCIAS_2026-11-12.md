# Cierre selectivo de Leo — evidencia y pruebas faltantes (2026-11-12)

## Alcance y restricciones
- Reutilizar la evidencia de CI existente. No repetir pruebas sintéticas sin cambio material.
- Solo Cloudflare Pages; no Vercel; no Wompi; no Connects; sin correo, WhatsApp, postulaciones ni compras externas.
- Sin activar Agente 1 ni fábrica. Pedro Imports siempre sintético.
- **Este documento registra auditoría; no certifica una venta, envío o cliente real.**

## Commits y regresión selectiva
- Último funcional desplegado: `bc258eded7b2456475d552cc910e5256f524cc2f`.
- HEAD revisado: `3f5512cc17bd017a7b7afe6b3ba545e66212e455`.
- Comparación GitHub `bc258ed...3f5512c`: un commit adicional; únicamente `README.md` (+2) y `docs/ops/LEO_ESTADO_ACTUAL_2026-11-12.md` (+41); **sin cambios de runtime**.
- La validación del commit `3f5512c` pasó: https://github.com/Rick2818/Boltech-Group/actions/runs/43269726878
- El deployment del commit funcional `bc258ed` pasó `validate`, `deploy`, `Publish to the existing Pages project` y `Verify actual production release`: https://github.com/Rick2818/Boltech-Group/actions/runs/43268819847
- Aceptación sintética Pedro Imports pasó anteriormente: https://github.com/Rick2818/Boltech-Group/actions/runs/43268486467
- Leo autonomy safety gates pasó: https://github.com/Rick2818/Boltech-Group/actions/runs/43267118478
- Las pruebas existentes son **controladas/mocks**; no certificar proveedores externos con estos resultados.

## Hallazgos concretos
1. `scripts/pages_ci.py verify` valida que `/api/leo-chat-status` anuncie el motor y que sea seguro, pero admite `enabled=false`. **CI verde confirma publicación e infraestructura; no activación de Gemini**.
2. `cloudflare/leo-native-chat.mjs` conserva máximo 12 turnos aportados por el cliente y timeout del proveedor 12 s; **no hay recuperación persistente del historial entre sesiones**, ni prueba real con la API de Gemini. La configuración de la API key no se verifica con una llamada real en el job deploy.
3. `cloudflare/leo-commercial-executor.mjs` genera/persiste un plan `INTERNAL_ONLY`, sin outbound. `prepare_onboarding` prepara una invitación, no aprovisiona agente, canal ni pago.
4. La sincronización del ledger `COMMERCE` con el CRM Supabase no está acreditada por las pruebas vistas. El almacenamiento KV no garantiza transacciones CAS concurrentes.
5. La publicación correcta del release no equivale a autorización de Explee/Upwork ni a ejecución comercial externa. Estado de autorizaciones por verificar directamente con proveedor.
6. El acceso HTTPS al dominio desde este entorno de auditoría no permitió leer `/api/leo-chat-status`; no afirmar `READY`.

## Pruebas mínimas aún no certificadas — orden de ejecución
- [ ] **P1 Chat vivo**: leer `https://boltech-group.pages.dev/api/leo-chat-status`, comprobar `enabled=true,configured=true,traffic=NATIVE,reason=READY`; obtener respuesta real `provider=gemini-cloudflare` sin datos personales, y probar una recuperación 429/timeout. No cambiar variables ni contratar servicios sin revisión de cuota/costo.
- [ ] **P2 Historial**: una conversación ES/EN con continuidad entre sesiones; aislar identidades y probar reintento sin pérdida. Si falta, implementar persistencia consentida y controles de concurrencia antes de certificarla.
- [ ] **P3 Seguimientos**: demostrar un evento interno persistido y un evento programado con reintentos e idempotencia; para envío externo, exigir canal autorizado y recibo real, sin disparar mensajes de prueba a terceros.
- [ ] **P4 Posventa**: en entorno aislado, verificar separación clara entre `CLOSED_WON_REPORTED`, `PAYMENT_VERIFIED`, `AGENT_ACTIVATED` y `DELIVERED`; no activar agentes ni tocar Wompi. Si aún no existe aprovisionamiento, marcar como no implementado.
- [ ] **P5 Datos/integraciones**: probar mapping COMMERCE→Supabase en sandbox y permisos Explee/Freelancer/Upwork con consultas de lectura permitidas; sin Connects, mensajes ni compras.
- [ ] **P6 Certificación live Cloudflare**: comprobar commit y rutas visibles, logs sin errores, rollback, alertas y funcionamiento sin navegador. Reutilizar la prueba deploy exitosa para publicación y comprobar solo comportamiento vivo faltante.

## Resultado
**Probado:** integración sintética, controles CI, despliegue de código funcional a Cloudflare y coincidencia de activos verificada por Actions.
**No probado:** Gemini realmente habilitado con proveedor, historial entre sesiones, seguimientos externos 24/7, conciliación Supabase y pagos, agente del cliente activado, entrega final.
**Acción siguiente:** certificación de runtime P1, sin tocar secretos ni proveedores externos; resolver los fallos demostrados en una rama independiente y con PR.


## Actualización de tarde — punto de reanudación desde ChatGPT Work

Verificaciones en vivo completadas desde conectores:
- Supabase proyecto `uxwfqhromoicrwzyylbn`: estado `ACTIVE_HEALTHY`, PostgreSQL 17, región `us-east-1`.
- Tablas CRM presentes con RLS habilitado. `crm_leads`, `crm_followups`, `crm_orders`, `crm_events` y `crm_jobs` reportaron **0 filas**. Esto no prueba conexión del flujo `COMMERCE` → CRM.
- Existen registros en otras tablas heredadas `leads`, `opportunities` y `agent_work`; no confundirlos con el CRM nuevo ni con ventas de Leo.
- GitHub Actions run `43268819847`: jobs `validate` y `deploy` correctos y `Verify actual production release` exitoso. Este paso verifica archivos desplegados y rutas seguras, **NO** `reason=READY` ni Gemini real.
- Desde ChatGPT/web no fue posible obtener contenido de `https://boltech-group.pages.dev/api/leo-chat-status` o `/sales-agent`; se documenta como **sin comprobación**, no como servicio caído.
- La rama de auditoría y este archivo son de documentación; **no contienen cambios de runtime**.

### Instrucciones para Work, cuando esté disponible
1. Abrir el proyecto GitHub `Rick2818/Boltech-Group` y este archivo; comprobar `main` y Actions.
2. Usar navegador de Work, con la sesión autorizada del usuario, para leer `/api/leo-chat-status` y verificar `enabled=true, configured=true, traffic=NATIVE, reason=READY`; no pedir ni divulgar secretos.
3. Si Gemini aún está deshabilitado, revisar costo/cuota gratis y la configuración existente de Cloudflare Pages; activar solo tras constatar permiso y ausencia de cargos no autorizados. Hacer consulta de chat real con fixture sin datos personales.
4. Probar continuidad del historial; construir corrección acotada y pruebas solamente si se confirma la falla. Mantener interfaz ES/EN y no activar audio sin consentimiento.
5. Comprobar ledger en KV y conexión con Supabase mediante caso aislado, idempotencia y RLS; no insertar clientes ficticios en CRM real.
6. Comprobar eventos internos de seguimiento y trazas; **no** enviar mensajes sin canal/consentimiento ni obtener Connects.
7. Comprobar setup, FAQ, estado de pago y aprovisionamiento. Wompi es intocable; utilizar sandbox si es necesario.
8. Antes de fusionar cualquier código runtime, ejecutar regresión selectiva sobre rutas modificadas, luego publicar únicamente en Cloudflare Pages y verificar commit + humo de producción. No marcar como completada una prueba no ejecutada.

### No bloquear / no afirmar
- La confirmación de un workflow exitoso **sí** permite afirmar despliegue del código `bc258ed`; **no** permite afirmar Gemini activo, CRM sincronizado ni agente de cliente entregado.
- Upwork sigue sujeto a OAuth/MCP externo; Explee requiere permiso válido; Freelancer no debe ejecutar acciones de pago.
- Si algo exige permisos de Cloudflare ausentes en Chat, dejarlo como pendiente específico de Work; no inventar certificación.

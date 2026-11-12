# Boltech Group — punto de continuidad operativo (12 noviembre 2026)

Este archivo es un resumen del estado del proyecto para futuras sesiones. **Distingue las modificaciones de código de las funciones probadas en producción.** No contiene secretos, clientes reales ni tokens.

## Decisiones vigentes

- Repositorio: `Rick2818/Boltech-Group`.
- Hosting de producción previsto: **Cloudflare Pages**, proyecto `boltech-group`, dominio `https://boltech-group.pages.dev`. **No volver a desplegar en Vercel.**
- Agente central: **Leo**, vendedor/atención al cliente, con objetivo comercial 24/7 y posventa. **Agente 1 fue retirado**; la Fábrica de Agentes está cancelada.
- Wompi y los pagos quedan intactos. No activar correos fríos, postulaciones, Connects, créditos, crons antiguos, mensajes o suscripciones sin autorización aplicable.
- No convertir pruebas de Pedro / Pdro Imports en ingresos, contratos ni clientes reales.
- La interfaz debe preservar conversación ES/EN, voz femenina salvadoreña suave y controles de audio sin oscilaciones.

## Código fusionado a `main`

| PR | Cambio | Lo probado / límite |
|---|---|---|
| [#368](https://github.com/Rick2818/Boltech-Group/pull/368) | Expediente comercial `/api/leo-commerce`: calificación, propuesta, aprobación, notas y cierre reportado | Owner-only; no envío externo ni pago verificado |
| [#369](https://github.com/Rick2818/Boltech-Group/pull/369) | Formulario de solicitud consentida `/api/leo-public-intake` | Lead `NEW_UNVERIFIED` almacenado cifrado en COMMERCE; no validación externa de identidad |
| [#371](https://github.com/Rick2818/Boltech-Group/pull/371) | E2E sintético de Pedro usando handlers reales | 1 recorrido, 12 pruebas de integración y 11 pruebas de soporte; 0 mensajes/cobros; sin Meta real |
| [#372](https://github.com/Rick2818/Boltech-Group/pull/372) | Ejecutor comercial de Cloudflare `/api/leo-execute`, planificación automática al captar leads, invitación posventa | Plan interno y ficha vinculados; no envía invitación ni activa agente |
| [#373](https://github.com/Rick2818/Boltech-Group/pull/373) | Chat generativo Gemini nativo en Cloudflare y diagnóstico `/api/leo-chat-status` | CI de PR validó código; **no está acreditada activación del motor ni despliegue final** |

Último commit de funcionalidad conocido del PR #373: `bc258eded7b2456475d552cc910e5256f524cc2f`. No afirmar que sea el commit desplegado sin comprobar Cloudflare.

## Estado real que debe comprobarse antes de prometer autonomía

1. Confirmar desde el job `deploy` en [Cloudflare Pages — Leo production](https://github.com/Rick2818/Boltech-Group/actions/workflows/cloudflare-pages-production.yml) el commit desplegado, y el paso `Verify actual production release`.
2. Verificar `https://boltech-group.pages.dev/api/leo-chat-status`: `enabled=true`, `configured=true`, `traffic=NATIVE`, `reason=READY`. Para activar la ruta nativa son necesarios `LEO_NATIVE_CHAT_ENABLED=true` y `GEMINI_API_KEY` o `GOOGLE_GENERATIVE_AI_API_KEY` válido **en Cloudflare**, tras comprobar costo/cuota del proveedor. Sin el flag el chat usa compatibilidad con el backend antiguo `e912df66.boltech-group.pages.dev`.
3. Realizar prueba real del chat generativo y del audio, historial, reintentos, latencia y conversación móvil. No hay certificación de historia persistente entre sesiones.
4. Seguimientos externos / cierre autónomo: Upwork tiene OAuth/MCP externo pendiente de revisión, Explee no ha acreditado permiso de búsqueda/envíos, Freelancer es de lectura; WhatsApp/correo requieren canal, opt-in y entrega verificable. No enviar hasta resolver permisos, pruebas y límites de frecuencia.
5. Posventa: `/customer-setup` permite catálogo/FAQ y aceptación del conocimiento. **No** provisiona todavía el agente IA final del cliente, WhatsApp real, pagos, ni aceptación de entrega operativa.
6. Supabase Boltech Group (proyecto `uxwfqhromoicrwzyylbn`) figuró `ACTIVE_HEALTHY` en auditoría; ocho cron jobs aparecieron `active=false`, no había Edge Functions listadas y los contadores de `crm_leads`, `crm_followups`, `crm_orders` eran cero. El flujo nuevo escribe en COMMERCE KV de Cloudflare, no está probado como sincronizado al CRM Supabase.
7. `AGENTS.md` en `main` contiene aún instrucciones obsoletas de Agente 1 / Vercel. El borrador [PR #370](https://github.com/Rick2818/Boltech-Group/pull/370) propuso corregirlo, pero una prueba heredada de rutas Vercel falló: **no fusionar sin resolver ese control**.

## Política de afirmaciones

- CI verde demuestra únicamente el alcance probado con mocks y ensayos. Verificar el proveedor y el dominio en vivo antes de decir «en producción».
- Un cierre `CLOSED_WON_REPORTED` y una ficha `CONFIGURATION_ACCEPTED` **no** equivalen a `PAYMENT_VERIFIED`, `AGENT_ACTIVATED` ni `DELIVERED`.
- El escenario `SYN_PDRO_IMPORTS_001` es siempre ficticio.
- No registrar credenciales o datos reales en Git.

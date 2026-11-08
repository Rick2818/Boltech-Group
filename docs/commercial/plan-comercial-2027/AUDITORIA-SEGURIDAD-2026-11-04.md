# Auditoría de seguridad — Clonador (2026-11-04)

Alcance: `src/bridge.mjs`, `src/marketing.mjs`, `src/funnel.mjs`, `src/seo.mjs`, `src/cli.mjs`, configuración y evidencias. Realizado contra el código del commit `3f5fc29`.

## Resumen
No se encontraron vulnerabilidades explotables de acceso externo. El puente local exige tokens distintos de 32+ caracteres, compara con tiempo constante, limita el body a 16 KiB, enlaza a `127.0.0.1` y exige `application/json`. Los datos se escriben con permisos `0600`/`0700` y nombres de archivo con hash (SHA-256) del par tenant+evento, por lo que el tenant no se puede escapar por path traversal.

## Controles que ya protegen
- **Auth**: `timingSafeEqual`, tokens ≥32 y distintos (`createMarketingBridge`).
- **Red**: escucha solo en `127.0.0.1` (`startLocalBridge`).
- **Método/URI**: solo POST a rutas allowlist (`/v1/a2a/events`, `/v1/a2a/materials`, `/v1/operator/*`).
- **Tenants**: `CLONADOR_OPERATOR_TENANTS` limita la superficie del token de operador; sin él, el token puede leer/escribir cualquier tenant (documentar).
- **Confidencialidad**: `sanitizeExternal` enmascara correos, teléfonos y enlaces en borradores hasta aprobación humana; `sourceReceipt` obligatorio para eventos externos.
- **Escritura atómica**: `writeAtomic` + `O_EXCL` temp + `rename`; locks con PID/TTL y detección de alive.
- **Recibos**: aprobación registra `draftDigest` (SHA-256); `handoff` lo reverifica antes de marcar `QUEUED_FOR_A2A`.
- **FS**: `ensureDir` `0700`, state `0600`.
- **Web**: en `funnel.mjs`/`seo.mjs` todo se escapa con `escapeHtml` y JSON-LD usa `\u003c`; el formulario no envía a ningún endpoint.

## Riesgos y recomendaciones
1. **Sin límite de intentos de autenticación.** El puente rechaza tokens malos, pero no hay rate-limit ni bloqueo temporal; un proceso local podría intentar fuerza bruta sin señal. Mitigación recomendada: contador por IP+ruta y 429 tras 5 fallos en 60 s.
2. **Tenant scope opcional.** Si `CLONADOR_OPERATOR_TENANTS` está vacío, un token de operador basta para todo. Documentar o exigir que se defina para entornos con más de un tenant.
3. **Sin reinicio automático tras crash.** `LOCK_STALE_MS` (5 min) y `UNREADABLE_LOCK_STALE_MS` (30 s) manejan locks huérfanos, pero un proceso muerto sigue mostrando `BUSY` hasta el TTL; el CLI ya expone `reconcile --apply`.
4. **Header hostil.** Si el puente se expone tras un proxy (no recomendado), conviene `Host` allowlist y `Cache-Control: no-store` (ya presente en respuestas).
5. **Dependencias**: sin paquetes externos en runtime; no hay superficie de supply chain desde dependencias.

## Pruebas
`npm test` → 75 pasadas, 0 fallos. `npm run check` → sintaxis OK. `npm pack --dry-run` → solo archivos del repo, sin `.clonador/` ni `.env`.

## Veredicto
Adecuado para uso local con un único operador humano. No apto para exposición a red ni para multi-tenant con secretos compartidos sin el control de scope de tenants.

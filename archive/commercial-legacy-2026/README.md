# Archivo comercial anterior — Boltech Group

Fecha: 2026-10-21

## Sistema vigente
La plataforma comercial vigente utiliza Supabase como CRM canónico y el ejecutor continuo de Agente 1. La cuenta de envío sigue siendo Gmail empresarial. Wompi no se modifica.

## Código heredado preservado, no reutilizable
- `lib/sdr_dispatch.js` → `archive/commercial-legacy-2026/lib/sdr_dispatch.js` (implementación Airtable).
- `lib/sdr_campaign.js` → `archive/commercial-legacy-2026/lib/sdr_campaign.js` (implementación antigua).

Estos archivos de origen siguen en `lib/` temporalmente por compatibilidad con pruebas y otras referencias históricas; **no constituyen el motor comercial vigente**. No se deben conectar al Agente 1 ni usar para envíos. Hay una prueba automática que impide que el Agente 1 vuelva a importar el dispatcher antiguo o su configuración de Airtable.

## Eliminación física pendiente
Antes de quitar los módulos heredados restantes de `lib/`, `api/` y workflows, inventariar todas las importaciones y llamadas productivas y sustituir las dependencias genuinamente activas por equivalentes Supabase; nunca romper pagos, servicios existentes ni seguimiento verificado. Se hará por PR con contratos y gobernanza.

## Estado de envíos
La preparación y revisión de borradores es interna. Envíos NO habilitados hasta disponer de un ejecutor Supabase-nativo con recibos Gmail, idempotencia, historial y supresiones validados. No se interpretará un buzón genérico verificado como aprobación comercial.

## Preservación adicional (2026-10-21)
Se copiaron al archivo los ocho módulos históricos `lib/rsi01_*` de campaña, preparación, búsqueda y seguimiento y los ejecutores `scripts/rsi01-gmail-dispatch.cjs` y `scripts/rsi01-outreach-executor.cjs`. Estas copias son históricas y no son componentes autorizados del sistema actual. Los archivos originales aún existen por compatibilidad de pruebas y referencias; su eliminación definitiva requiere un PR separado con inventario de dependencias. Las únicas programaciones comerciales cron habilitadas en Supabase son boltech-research, boltech-inbox, boltech-explee, boltech-receipts y boltech-marketing.

## Eliminación de manejadores API (2026-11-03)

El API de socios ya no importa ni define ejecutores de campañas SDR/RSI-01, integraciones Apollo heredadas ni los bucles de cold email. Las rutas históricas conservan una respuesta autenticada HTTP 410 sin ejecutar código de envío. El monitor solo comprueba su bloqueo con solicitudes GET seguras; el antiguo test `sdr-verify` dejó de usarse como falso indicador de la disponibilidad de Gmail.

Los módulos históricos restantes del directorio `lib/` continúan como compatibilidad de pruebas y para facilitar auditoría de referencias. No están autorizados como servicio comercial vigente. El transporte Gmail que utiliza Leo para cotizaciones solicitadas por clientes permanece separado y está sujeto a aprobación y consentimiento. No se reactivan campañas, cron comerciales ni envío automático.

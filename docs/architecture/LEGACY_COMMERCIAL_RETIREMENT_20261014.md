# Retiro controlado del proceso comercial anterior — 2026-10-14

Orden: sustituir íntegramente el flujo comercial legado de Boltech Group por la arquitectura ASMAS V4.1 comercial, SIN conservar ejecutores duplicados.

## Estado de seguridad
- Respaldo de main: `backup/boltech-commercial-legacy-20261014`.
- Rama de trabajo aislada: `chore/remove-legacy-commercial-flow-20261014`.
- Este documento no ejecuta ni certifica la eliminación del flujo viejo.
- **No borrar registros financieros, recibos de Wompi, conciliaciones de pagos o contratos ni credenciales compartidas**.
- No deshabilitar directamente endpoints que otras funciones no comerciales necesitan.

## Componentes que deben identificarse y retirarse al reemplazar
- Automatismos anteriores de descubrimiento/enriquecimiento de leads, campañas de correo, seguimiento, workflows n8n, RSI 01/02/03 comerciales y cron asociados.
- Gateways A2A, rutas de correo y CRM exclusivamente utilizados por el flujo comercial antiguo.
- UI, scripts, tests, secretos exclusivos y documentación operativa heredada que activen procesos obsoletos, con clasificación de dependencias antes de eliminar.

## Puerta de migración
1. Inventariar árbol completo de main y referencias, cron Vercel, endpoints, colas, GitHub Actions y configuraciones alojadas.
2. Separar lógica comercial eliminable de Wompi, seguridad, infraestructura y datos que deban preservarse.
3. Crear commits de retiro por grupos con tests de compilación y no-regresión; primero desconectar disparadores para evitar dobles correos.
4. Integrar flujo ASMAS con permisos controlados, escenarios sintéticos y rollback.
5. Solo después de pasar CI, revisión de datos y respaldo, fusionar a main y comprobar Vercel. No decir que el flujo comercial nuevo vende sin prueba real.

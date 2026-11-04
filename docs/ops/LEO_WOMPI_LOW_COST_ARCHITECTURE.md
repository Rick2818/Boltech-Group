# BOLTECH GROUP · Alojamiento ordenado con Leo y Wompi
Fecha: 2026-11-04. Estado: modo mínimo de producción. No hay autorización para gastos, reactivar comercial o modificar la pasarela.

## Servicios activos
- Sitio y archivos estáticos: Vercel CDN, cache de assets y página de Leo.
- API de Leo: `api/index.js` solamente chat, voz Rodrigo, objetivos, canales y worker autorizado. Importación diferida por ruta.
- Cobro: `api/payments.js` y los webhooks verificados, SIN cambios en su contrato, llaves, idempotencia ni conciliación.
- Estado: Redis (objetivos/cola), Supabase (cron/recibos), Airtable (órdenes de pago existentes).

## Servicios inactivos
Prospección, Agente 1, mercadeo, cold email, CRM antiguo, A2A, MCP y otras funciones históricas. Su código sigue conservado en Git para recuperación controlada. Los endpoints no esenciales permanecen en HTTP 410. Los ejecutores de Supabase que no son de Leo están inactivos.

## Consumo: medición separada
Active CPU de Vercel es acumulado del período y no disminuye después de los cambios. Medir CPU total por proyecto/función, invocaciones y memoria por intervalos de 24 horas comparables: antes del despliegue y después, excluyendo pruebas y despliegues. El endpoint de métricas del conector puede devolver HTTP 400 en Hobby; en ese caso extraer la vista Usage de Vercel manualmente. No atribuir la reducción 93,3 % de cron a CPU de Vercel.

Objetivo inicial: >=50 % menos CPU *medida* respecto de base comparable sin degradación de funciones activas. Presupuesto de referencia de Hobby: 4 h/30 días, sujeto a cambios del proveedor y al carácter comercial del producto.

## Normas de explotación
1. No cambiar Wompi, credenciales, checkout, validación de firma o webhooks sin certificación independiente.
2. Leo puede responder inmediatamente al usuario. La autonomía ejecuta solo tareas previamente aprobadas. Scheduler Supabase cada 15 min; nunca crear un segundo cron.
3. Usar tareas bajo demanda para reducir CPU cuando la cola esté vacía, **pero no duplicar credenciales de Redis a Supabase**. Se requiere diseño seguro de señal de tareas y prueba de entrega antes de cambiar el scheduler.
4. No publicar ni gastar en nuevas herramientas ni subir de plan automáticamente.
5. Toda nueva función o trigger debe tener responsable, coste estimado, TTL/timeout, límite de llamadas, registro de errores, pruebas y plan de reversión.
6. Revertir mediante PR a la versión anterior si falla voz, chat, objetivos, cotizaciones, pagos o webhook.
7. Antes de entregar producción: CI en verde y smoke HTTP de Leo, Wompi, rutas antiguas, sin ejecutar cobros reales.

## Dependencias y límites
Requiere comprobación real de conversacion y voz en navegador y confirmación de proveedor Wompi en un ambiente autorizado. HTTP 405 en una ruta de POST consultada por GET solo confirma el control de método. HTTP 200 del readiness público Wompi no certifica transacción real. El nuevo router retira imports de servicios pausados de la función principal, pero los módulos de API dedicados continúan en repositorio y se pueden desplegar como funciones si se mantiene esa estructura; su retirada física será una fase aparte después de ajustar pruebas y comprobar impactos.

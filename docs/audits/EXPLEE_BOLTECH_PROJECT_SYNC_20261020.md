# Explee: autenticación y destino de Boltech — 20 octubre 2026

## Decisión y responsable
Responsable: mantenimiento técnico autorizado por Ricardo. Objetivo: autenticar Explee en Vercel y sincronizar únicamente el proyecto Boltech con Supabase, usando el workflow existente y sin gasto nuevo.

Recorrido: Explee (50656) → endpoint de Boltech en Vercel → tablas explee_hot_leads/cursor en Supabase. Se conservan los dos agentes comerciales vigentes, Ventas y Mercadeo.

## Evidencia y corrección
- Computer Use verificó la cuenta de Explee y su selector: boltech-group.vercel.app = 50656; apiskey.online = 51973.
- EXPLEE_API_KEY fue reemplazada en Vercel Production desde la clave existente de Explee. No se guarda su contenido en Git.
- El primer reintento devolvió EXPLEE_CAMPAIGNS_HTTP_401; tras corregir la clave y redesplegar, el trabajo 118965028129 devolvió status OK, fetched 0 y projectId 51973. Esa prueba acreditó autenticación, pero reveló el proyecto equivocado.
- Se corrige el destino fijo del sincronizador a 50656 y se añade una regresión que exige ese proyecto en consulta de campañas, cursor y registros persistidos.
- Pruebas locales: node --test tests/test_explee_hot_leads_sync.mjs — 2/2 aprobadas. Las pruebas usan proveedores simulados y no acreditan importación real.
- Antes de la corrección de destino: 0 hot leads y 0 duplicados en Supabase.

## Aceptación y recibos productivos
Consultar el intento más reciente del workflow:
https://github.com/Rick2818/Boltech-Group/actions/runs/39509586336

El criterio productivo es status OK y projectId 50656 contra el despliegue que contiene esta corrección; contrastar fetched con Explee y Supabase. El workflow existente programa consultas cada diez minutos. Una lectura vacía exitosa acredita conexión y alcance, pero no importación de un contacto ni venta. No crear leads sintéticos en producción para aparentar éxito.

## Límites y recuperación
No se cambian campañas, presupuesto, envíos, Wompi ni el esquema de Supabase. No hay una integración nueva. Reversión acotada: revertir este cambio de código si falla la regresión; una credencial incorrecta se reemplaza en el almacén de Vercel y se redespliega. No registrar claves en logs.

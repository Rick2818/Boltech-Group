# Leo — captación pública consentida y estado de automatización (12 nov 2026)

## Implementación
El chat público en `/sales-agent` ahora ofrece el formulario «Solicitar propuesta a Leo». Con consentimiento explícito, crea un expediente cifrado en la misma base comercial del propietario vía `POST /api/leo-public-intake`. El cliente ve una referencia, **no un contrato ni un comprobante de pago**. El propietario abre el expediente por ID en el panel privado «Gestión comercial».

Se registran los datos proporcionados por el solicitante y el estado `NEW_UNVERIFIED`. El correo y la identidad **no quedan verificados automáticamente**. El formulario no implica consentimiento para mensajes de seguimiento. El endpoint público nunca recibe ni usa credenciales de propietario. Se aplican verificaciones de origen, campos, trampa antispam y enfriamiento KV no transaccional de diez minutos.

## Automatización pendiente: condiciones estrictas
El servicio Cloudflare sigue disponible para recibir solicitudes entrantes en cualquier horario, pero esto **no certifica agentes autónomos ejecutando trabajo 24/7**.

- **Upwork:** bloqueo de registro OAuth/MCP con callback aún pendiente de soporte. No usar envío ni postulación.
- **Explee:** acceso y permisos de búsqueda por confirmar. La consulta es lectura; sin envíos.
- **Freelancer:** conector existente sólo lectura. No postular ni enviar mensajes sin autorización de plataforma y de la empresa.
- **Correo y WhatsApp:** no hay adaptador de salida ni confirmación de dominio/plantillas de mensaje y consentimiento verificable. Sin envíos automáticos.
- **Seguimientos:** se pueden registrar notas/borradores manuales mediante el módulo de comercio; ningún timer o cron los envía.

Para permitir seguimientos automáticos en una siguiente fase se requiere al menos: canal de salida autorizado y comprobado, dirección o número verificado, consentimiento específico para ese canal, supresión de bajas, límite de frecuencia, mecanismo de exclusión mutua/idempotencia con almacenamiento transaccional, trazabilidad de aceptación del proveedor y límites de gastos. No se deben interpretar recibos locales como entregas.

## Verificación
```bash
node --test tests/test_leo_public_intake.mjs tests/test_leo_commerce.mjs
python3 scripts/pages_ci.py build
node --check .cloudflare/pages-release/_worker.js
```

Después del despliegue a Cloudflare, verificar HTTP 201 en una solicitud expresamente consentida con datos de prueba aislados, recepción de la referencia y lectura autenticada por el propietario. Los ensayos con datos sintéticos no se deben introducir como clientes reales.

# Boltech Group — Demostración n8n aislada

**Estado:** plantilla no desplegada ni probada en vivo. El contenedor existente `boltech-n8n` y las credenciales configuradas anteriormente deben revisarse **antes** de reinstalar o recrear cualquier cosa. No modificar Leo, Cloudflare, Supabase ni Wompi.

## Primero: reutilizar la instancia existente
1. Abrir n8n en la misma computadora donde funciona Docker (`http://localhost:5678`) y revisar `Credentials` y `Executions` del contenedor existente. **No repetir la instalación, creación del bot, tokens u OAuth si siguen válidos.**
2. Identificar la copia original del flujo y la fecha de su última ejecución. El JSON de GitHub es una **plantilla saneada**, no una exportación de las credenciales vigentes.
3. Conservar inactivas las copias duplicadas. No importar otra instancia o activar el formulario dos veces.
4. Si el contenedor existente se pierde, el `docker-compose.yml` adjunto sirve para una **instancia de demostración local**, no para hosting 24/7. La guía de Docker solo aplica en una recuperación expresamente decidida.

## Configuración/validación solo si hace falta
- **Google Sheets:** confirmar credencial OAuth asignada y hoja `Leads`, con columnas `lead_id, fecha, nombre, email, empresa, necesidad, estado, origen`. El marcador `REEMPLAZAR_SPREADSHEET_ID` es exclusivo de esta plantilla.
- **Telegram:** verificar credencial existente `Telegram account` y destino del propietario; comprobar mensaje en la cuenta autorizada. El marcador `REEMPLAZAR_CHAT_ID` es exclusivo de esta plantilla.
- **Gmail:** verificar la credencial OAuth2 `Gmail account` vigente. **Importante:** en esta plantilla, el destinatario es **solo** la variable de n8n `BOLTECH_DEMO_TEST_INBOX`, que debe apuntar a un buzón de prueba controlado/autorizado. Si no existe o está vacía, el envío falla cerrado. **Nunca** utilizar el correo introducido por un formulario no verificado.
- Nunca publicar tokens, IDs sensibles, secretos OAuth ni credenciales en el repositorio, ni volver a pedirlos si la instancia ya los conserva.

## Alcance técnico y verificación
Formulario de prueba → normalización → Sheets → alerta Telegram y **correo al buzón interno de prueba**, con tres intentos totales de Gmail, salida explícita de error y alerta Telegram. Esta demo **no** es el sistema de ventas/seguimiento comercial productivo.

Pruebas obligatorias y registrables:
1. Datos sintéticos con correo propio de prueba → fila en Sheets, con ID y sello temporal.
2. Mensaje de Telegram recibido por el propietario.
3. Correo recibido exclusivamente en `BOLTECH_DEMO_TEST_INBOX`, con ID genuino/recibo del proveedor.
4. Error controlado de Gmail → alerta Telegram; verificar que una ejecución gestionada como «success» no oculte fallos.
5. Idempotencia y recuperación: si se reintenta, no generar registros/envíos duplicados; documentar cualquier limitación detectada.
6. Verificar `Executions` y anotar hora, resultado, referencia del proveedor y **captura sin secretos**.

Ejecutar `node --test portfolio/n8n-demo/test_flow_safety.mjs` para validar la estructura y las barreras de seguridad de **esta plantilla**. Esa prueba estática **no valida** las APIs ni la disponibilidad del contenedor.

Mantener el workflow inactivo fuera de las pruebas autorizadas. Sin evidencia real de ejecución, no anunciar producción. Para operar 24/7 hace falta servidor persistente, HTTPS y configuración de webhooks. Este flujo no garantiza transacciones atómicas, control de duplicados ni entrega automática de agentes. El cierre de punta a punta se sigue en [issue #380](https://github.com/Rick2818/Boltech-Group/issues/380).

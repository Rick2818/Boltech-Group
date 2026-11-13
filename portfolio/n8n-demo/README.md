# Boltech Group — Demostración n8n aislada

**Estado:** plantilla no desplegada ni probada en vivo. No modificar Leo, Cloudflare, Supabase ni Wompi.

## Instalación en Windows
1. Instalar Docker Desktop con WSL 2 y esperar que el motor esté activo.
2. En la carpeta de este proyecto ejecutar `docker compose up -d`.
3. Abrir http://localhost:5678 y crear usuario local.
4. En n8n importar `boltech_demo_n8n.json`. Mantener inactivo hasta configurar y probar.

## Configuración
- **Google Sheets:** crear hoja `Leads` con columnas `lead_id, fecha, nombre, email, empresa, necesidad, estado, origen`. En el nodo seleccionar credencial OAuth de pruebas y reemplazar `REEMPLAZAR_SPREADSHEET_ID`. Revisar mapeo.
- **Telegram:** crear bot con BotFather; configurar credencial en n8n; sustituir `REEMPLAZAR_CHAT_ID`. Iniciar conversación con el bot.
- **Gmail:** autorizar cuenta de prueba mediante OAuth. No enviar correos comerciales.
- Nunca publicar tokens o credenciales en el repositorio.

## Alcance y verificación pendiente
Formulario → normalización → Sheets → ramas de Telegram y Gmail. Gmail tiene tres intentos **en total** y una salida de error que activa una alerta Telegram. La ejecución puede verse exitosa aun con fallo gestionado: inspeccionar nodo Gmail y salida de error.

Pruebas: envío de formulario con datos de prueba; fila en Sheets; mensaje Telegram; email recibido; fallo controlado de Gmail sin enviar a terceros; historial de ejecuciones n8n. No afirmar operación real hasta verificar estos pasos.

El formulario local solo abre en esta PC. Para exponerlo públicamente se necesita HTTPS seguro y configuración de webhooks. La demo no garantiza transacciones atómicas ni control de duplicados. Para detener sin borrar el volumen: `docker compose down`.

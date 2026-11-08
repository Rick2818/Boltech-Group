# WhatsApp con Leo — conexión

Actualizado: 2026-11-06

Leo ya está programado y desplegado. Lo que falta son las credenciales del
proveedor: sin ellas el endpoint **no envía nada** y lo dice con honestidad.

- Endpoint: `https://boltech-group.pages.dev/api/whatsapp`
- Estado real: abrir esa URL en el navegador.
  - `PENDING_CREDENTIALS` → falta configurar.
  - `READY_TO_RECEIVE` → listo para recibir mensajes.

---

## Opción recomendada: Meta WhatsApp Cloud API (sin costo por mensaje)

1. Entra a https://developers.facebook.com/apps → **Create app** → tipo **Business**.
2. En el panel de la app: **Add product** → **WhatsApp** → **Set up**.
3. Copia estos tres valores de *WhatsApp → API Setup*:
   - **Phone number ID** → `META_WA_PHONE_NUMBER_ID`
   - **Access token** (permanente, de un usuario del sistema) → `META_WA_ACCESS_TOKEN`
   - **App secret** (*App settings → Basic*) → `META_WA_APP_SECRET`
4. Inventa un texto cualquiera, por ejemplo `boltech-verify-2026`, y guárdalo como
   `META_WA_VERIFY_TOKEN`.
5. En **WhatsApp → Configuration → Webhook**:
   - Callback URL: `https://boltech-group.pages.dev/api/whatsapp`
   - Verify token: el mismo texto del paso 4
   - Suscribe el campo **messages**.
6. Agrega el número `+503 7574 3444` en **API Setup → To** y confirma el código
   que llega por WhatsApp.
7. Envía los 4 valores y los cargo como secretos del proyecto.

> Meta revisa el número y la cuenta de empresa. Hasta que apruebe, solo se puede
> escribir a números de prueba autorizados.

## Alternativa: Twilio (más rápido, de pago)

1. https://console.twilio.com → **Messaging → WhatsApp**.
2. Copia **Account SID**, **Auth Token** y el número de WhatsApp.
3. Webhook: `https://boltech-group.pages.dev/api/whatsapp` (método POST).
4. Variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`.

---

## Qué hace Leo cuando recibe un mensaje

| Situación | Respuesta |
|---|---|
| Saludo | Se presenta como asistente (no persona) y pregunta por la tarea |
| Precio | Cifras de referencia (US$600 prueba / desde US$900) sin promesas |
| Pedidos, facturas, stock | Explica las tres tareas y pregunta cuál aplica |
| Seguridad o datos | Permisos mínimos, sin pedir contraseñas, enlaces legales |
| Escribe un correo **sin** consentimiento | No guarda nada y pide consentimiento explícito |
| Escribe un correo **con** “acepto que me contacten” | Guarda el lead en Airtable y avisa por correo |
| Mensaje repetido de Meta | No responde dos veces (idempotencia por `message.id`) |
| Más de 30 mensajes por hora del mismo número | Se detiene (límite antiabuso) |

## Verificación técnica

- Firma `x-hub-signature-256` de Meta obligatoria cuando existe `META_WA_APP_SECRET`.
- Verificación del webhook (`hub.challenge`) solo con el token correcto.
- Respuesta diferenciada por proveedor (Meta Graph o Twilio REST).
- Si el envío falla, el registro en Airtable se conserva y el error queda en los
  logs de Cloudflare (`[whatsapp/...]`); nunca se reporta éxito falso.

## Prueba local

```powershell
cd "C:\Users\Ricardo\Desktop\A2A Project 2027\Plan Comercial tipo Relevance AI"
npx --yes wrangler@4 pages dev public --port 8788
# luego: http://127.0.0.1:8788/api/whatsapp
```

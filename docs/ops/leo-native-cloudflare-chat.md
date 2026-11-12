# Leo — transición controlada del chat generativo a Cloudflare Pages

**Ruta:** `POST /api?leo_sales=1`, mediante `cloudflare/leo-native-chat.mjs`.
**Estado de seguridad:** disponible en código; **NO afirmar activación en producción** hasta leer `GET /api/leo-chat-status` del dominio vigente y verificar una respuesta real del proveedor.

## Activación sin cambiar Wompi ni canales externos
La ruta nativa se activa exclusivamente cuando `LEO_NATIVE_CHAT_ENABLED=true` en las variables de entorno del proyecto **existente** Cloudflare Pages `boltech-group`. Requiere además un secreto `GEMINI_API_KEY` (o `GOOGLE_GENERATIVE_AI_API_KEY`) válido en ese entorno. El modelo predeterminado es `gemini-2.5-flash`; se puede definir `LEO_MODEL_NAME` con un identificador válido de Gemini compatible.

No crear suscripciones ni dar de alta claves nuevas automáticamente. Verificar primero si el plan/proveedor permite la llamada y su costo. La clave debe introducirse en el panel privado de Cloudflare, no GitHub ni el chat público.

Si el flag no está activo, el Worker mantiene el backend previo para no interrumpir clientes. Si está activo pero falta la clave, devuelve `NATIVE_CHAT_NOT_CONFIGURED` sin hacer una petición al backend anterior. Se trata de una migración explícita, no una activación automática por el commit.

## Seguridad y límites
- Validación de origen, mensajes e historial (máximo 12 turnos), límites de tamaño.
- Timeout del proveedor 12 segundos, respuestas de error genéricas sin exponer credenciales.
- La consulta **no realiza** pagos, correos, mensajes WhatsApp, postulaciones ni captura silenciosa de datos. El cliente sigue usando el formulario consentido para registrar propuestas.
- El chat no almacena automáticamente historial entre dispositivos o sesiones. Persistencia transaccional y aislamiento aún requieren implementación.
- Pagos y rutas ajenas al chat siguen encaminados al backend original. El cambio no reemplaza Wompi ni certifica una entrega al cliente.
- `/api/leo-chat-status` informa si el motor está habilitado/configurado sin exponer secretos. La CI debe comprobar esta ruta, además del HTML y del endpoint de ejecución comercial.

## Prueba de producción
1. Confirmar en GitHub Actions **Cloudflare Pages — Leo production** que el job `deploy` del commit de `main` pasa el chequeo `Verify actual production release`.
2. Abrir `https://boltech-group.pages.dev/api/leo-chat-status`; `enabled=true`, `configured=true`, `traffic=NATIVE` y `reason=READY` son requeridos para afirmar migración.
3. Enviar un saludo y una pregunta comercial auténtica desde la web de Leo, sin datos personales ni operaciones. Verificar respuesta válida y `provider=gemini-cloudflare`.
4. Probar la recuperación ante timeout/429 y la preservación de las rutas de pago, sin hacer cobros.
5. Para envíos externos o agentes de clientes, seguir los requisitos de autorización de plataforma, consentimiento, proveedor y activación verificada. **Este parche no activa esas capacidades.**

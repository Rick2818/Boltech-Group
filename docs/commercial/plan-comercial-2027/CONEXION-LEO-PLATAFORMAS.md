# Conexion de Leo a Upwork y Freelancer desde Cloudflare Pages

Host actual: **https://boltech-group.pages.dev** (Cloudflare Pages).
Este documento sustituye el runbook anterior basado en Vercel.

Estado: **codigo portado y probado; credenciales pendientes**. Nada esta
"conectado" hasta una lectura real controlada.

---

## 1. Que se agrego

| Archivo | Funcion |
|---|---|
| `src/leo_platform_connectors.mjs` | Conector read-only Upwork + Freelancer (Web Crypto, sin Node) |
| `functions/api/platform.js` | Ruta `/api/platform` con token obligatorio |
| `tests/platform-connector.test.mjs` | Pruebas deterministas, sin red |
| `docs/CONEXION-LEO-PLATAFORMAS.md` | Este documento |

Garantias:

- 4 tools, todas `readOnly: true` y `costUSD: 0`.
- No existe propuesta, puja, mensaje, contrato ni pago.
- `LEO_PLATFORM_WRITE_ENABLED=false` por defecto; escribir exige aprobacion
  humana con `approvedBy`, `approvalId` y `scope`.
- Idempotencia por tenant + tool + argumentos.
- Recibo obligatorio; sin recibo no hay exito.
- Timeout = `UNKNOWN`, sin reintento ciego.
- Contenido de plataforma marcado como no confiable; nunca se obedecen
  instrucciones embebidas.
- PII redactada sin consentimiento.
- Limite diario de lecturas.

---

## 2. Variables en Cloudflare

En **Workers & Pages → boltech-group → Settings → Variables and Secrets**:

```text
LEO_PLATFORM_TOKEN=<token largo y aleatorio>
UPWORK_MCP_ACCESS_TOKEN=<token del MCP de Upwork>
UPWORK_ORG_UID=<org_uid de la cuenta TALENT>
FREELANCER_API_ENABLED=false
FREELANCER_OAUTH_TOKEN=<token de la API de Freelancer>
LEO_PLATFORM_WRITE_ENABLED=false
LEO_PLATFORM_DAILY_READ_LIMIT=40
```

Nunca poner estos valores en `wrangler.toml` ni en Git.

### Upwork: diferencia con Vercel

Cloudflare no tiene Vercel Connect. Por eso el conector acepta un token directo
(`UPWORK_MCP_ACCESS_TOKEN`) o un `tokenProvider` inyectado. El flujo OAuth 2.1
completo contra `https://mcp.upwork.com/mcp` requiere implementar registro
dinamico y callback en `https://boltech-group.pages.dev/api/upwork/callback`.
No se implemento aun porque faltan los endpoints exactos confirmados por Upwork.

### Freelancer

1. `accounts.freelancer.com/settings/develop` → crear app.
2. Guardar `client_id`, `client_secret`, `redirect_uri`.
3. Generar token y guardarlo como `FREELANCER_OAUTH_TOKEN`.
4. Completar la auditoria de la API y sus terminos.
5. Solo entonces `FREELANCER_API_ENABLED=true` y redesplegar.

Mientras el gate este cerrado, toda llamada responde `FREELANCER_NOT_AUDITED`
sin tocar la red.

---

## 3. Uso del endpoint

```bash
# Estado (sin red, sin secretos)
curl -H "Authorization: Bearer $LEO_PLATFORM_TOKEN" \
  https://boltech-group.pages.dev/api/platform

# Buscar trabajos en Upwork
curl -X POST -H "Authorization: Bearer $LEO_PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"upwork_jobs","query":"n8n","limit":5}' \
  https://boltech-group.pages.dev/api/platform

# Buscar proyectos en Freelancer
curl -X POST -H "Authorization: Bearer $LEO_PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"freelancer_projects","query":"automation","limit":5}' \
  https://boltech-group.pages.dev/api/platform
```

Acciones permitidas: `status`, `upwork_accounts`, `upwork_jobs`,
`freelancer_projects`, `freelancer_project`. Cualquier otra devuelve
`LEO_PLATFORM_ACTION_NOT_ALLOWED`.

---

## 4. Verificacion local

```powershell
cd "C:\Users\Ricardo\Desktop\A2A Project 2027\Plan Comercial tipo Relevance AI"
npm test
npx --yes wrangler@4 pages dev
```

Sin `LEO_PLATFORM_TOKEN`, `/api/platform` responde 503
`LEO_PLATFORM_AUTH_NOT_CONFIGURED` (falla cerrado, no finge estar listo).

---

## 5. Codigos de bloqueo

| Codigo | Significado |
|---|---|
| `LEO_PLATFORM_AUTH_NOT_CONFIGURED` | Falta `LEO_PLATFORM_TOKEN` |
| `LEO_PLATFORM_AUTH_REQUIRED` | Token ausente o incorrecto |
| `LEO_PLATFORM_ACTION_NOT_ALLOWED` | Accion no permitida |
| `UPWORK_OAUTH_NOT_CONFIGURED` | Falta token de Upwork |
| `UPWORK_ORG_UID_REQUIRED` | Falta organizacion TALENT |
| `UPWORK_MCP_UNAUTHORIZED` | Token rechazado; no reintentar |
| `UPWORK_READ_TOOL_MISSING` | El MCP no expone la tool |
| `FREELANCER_NOT_AUDITED` | Gate de auditoria cerrado |
| `FREELANCER_CREDENTIALS_MISSING` | Falta token de Freelancer |
| `FREELANCER_SCOPE_OR_AUTH_REJECTED` | 401/403 de Freelancer |
| `LEO_PLATFORM_DAILY_LIMIT_REACHED` | Limite diario alcanzado |
| `LEO_PLATFORM_TIMEOUT_UNKNOWN` | Timeout incierto |
| `LEO_PLATFORM_RECEIPT_REQUIRED` | Sin evidencia, no hay exito |

---

## 6. Que sigue para romper el 0.00

1. Configurar `LEO_PLATFORM_TOKEN` y redesplegar.
2. Verificar `GET /api/platform` con ese token.
3. Configurar token de Upwork y `UPWORK_ORG_UID`.
4. Auditar Freelancer y abrir su gate.
5. Leo busca y resume; Ricardo elige.
6. Leo redacta; Ricardo aprueba y envia manualmente.
7. El gasto de Connects o creditos siempre lo autoriza Ricardo.

---

## 7. Acciones no ejecutadas

- No se envio ninguna propuesta, mensaje ni invitacion.
- No se gastaron Connects ni creditos.
- No se compraron planes.
- No se usaron credenciales reales.
- No se hizo ninguna llamada de red a Upwork ni a Freelancer.
- No se desplego nada.

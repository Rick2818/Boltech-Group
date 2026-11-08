# Despliegue en Cloudflare Pages — Boltech Group

Actualizado: 2026-11-06 · Proyecto: `plan-comercial-tipo-relevance-ai`

Esta guía deja el sitio en línea en Cloudflare Pages, con el formulario de
solicitud guardando leads y el asesor respondiendo en el mismo despliegue.

---

## Estructura del despliegue

```
Plan Comercial tipo Relevance AI/
├── public/                     ← lo único que se publica
│   ├── index.html
│   ├── solicitud.html
│   ├── privacidad.html / retiro.html / conservacion.html
│   ├── gmail-privacy.html / gmail-terms.html
│   ├── specialist.html / sales-agent.html / factory-preview.html
│   ├── manifest.webmanifest
│   ├── robots.txt / sitemap.xml
│   ├── _headers / _redirects
│   └── assets/…
├── functions/
│   └── api/
│       ├── lead.js             ← POST /api/lead (formulario + asesor)
│       └── index.js            ← POST /api/index (páginas heredadas)
├── wrangler.toml
└── .dev.vars                   ← secretos locales, NO se versiona
```

---

## Paso 1 · Crear el proyecto (5 minutos)

1. Entra a https://dash.cloudflare.com/ y crea una cuenta gratuita.
2. Menú lateral: **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Autoriza GitHub y elige el repositorio **`Rick2818/Plan-Comercial-tipo-Relevance-AI`**.
4. Rama: **`main`**.
5. Configuración de build (usa exactamente estos valores):

| Campo | Valor |
|---|---|
| Framework preset | `None` |
| Build command | *(vacío)* |
| Build output directory | `public` |

6. **Save and Deploy**.

El nombre del proyecto debe quedar exactamente **`plan-comercial-tipo-relevance-ai`**
para que la dirección sea `https://plan-comercial-tipo-relevance-ai.pages.dev`
(es la que usan el sitemap, el canonical y las páginas legales).

---

## Paso 2 · Conectar el almacén de solicitudes

El endpoint `/api/lead` responde `503 STORAGE_NOT_CONFIGURED` mientras no exista
un almacén. Esto es intencional: nunca simula un registro que no ocurrió.

### Opción A — Airtable (recomendada, tabla visible)

La cuenta ya tiene la base **Boltech CRM** con la tabla **Leads**. No hay que
crear nada nuevo (detalles en `docs/AIRTABLE-SETUP.md`).

1. En Cloudflare: **tu proyecto** → **Settings** → **Variables and Secrets** → **Add**.
   - `AIRTABLE_API_KEY` → token `pat…` de la cuenta
   - `AIRTABLE_BASE_ID` → `appCQZd0IhBHFoZ9P`
   - `AIRTABLE_TABLE_ID` → `tblZaox2MX5uYA5PZ`
2. Guarda y vuelve a desplegar (**Deployments** → **Retry deployment**) para que las variables apliquen.

### Opción B — KV de Cloudflare (sin terceros)

1. **Workers & Pages** → **KV** → **Create namespace** → nombre `leads`.
2. En el proyecto: **Settings** → **Functions** → **KV namespace bindings** → **Add**
   - Variable name: `LEADS`
   - Namespace: `leads`
3. Vuelve a desplegar.

### Correo de aviso (opcional)

La cuenta de Resend está en **modo de prueba**: solo puede entregar al correo
dueño de la cuenta (`rick28191@gmail.com`). Para enviar a cualquier otro destino
hay que verificar un dominio en https://resend.com/domains y cambiar
`LEAD_FROM_EMAIL` a una dirección de ese dominio.

- `RESEND_API_KEY` — clave de Resend.
- `LEAD_NOTIFICATION_EMAIL` — destinatario. En modo de prueba debe ser
  `rick28191@gmail.com`.
- `LEAD_FROM_EMAIL` — remitente. Por defecto `Boltech Group <onboarding@resend.dev>`.

Sin `RESEND_API_KEY` el formulario sigue registrando en Airtable; el campo
`emailNotified` de la respuesta será `false`.

---

## Paso 3 · Verificación (obligatoria antes de compartir el enlace)

Abre en el navegador y comprueba:

| Prueba | Resultado esperado |
|---|---|
| `GET /` | Página de inicio 200 |
| `GET /solicitud` | Formulario 200 |
| `GET /privacidad`, `/retiro`, `/conservacion` | 200 |
| Enviar formulario **sin** consentimiento | El navegador lo bloquea; el API devuelve `400 CONSENT_REQUIRED` |
| Enviar formulario **con** consentimiento | “Solicitud registrada”, fila nueva en Airtable/KV y correo de aviso |
| Abrir el asesor 💬 y preguntar “¿cuánto cuesta?” | Respuesta de precios de referencia |
| Botón “Dejar mis datos” + consentimiento | Registro nuevo con fuente `web_advisor` |

Prueba del API por línea de comandos (sustituye la URL si cambia el proyecto):

```powershell
# Asesor (no guarda datos)
curl.exe -s -X POST https://plan-comercial-tipo-relevance-ai.pages.dev/api/lead `
  -H "Content-Type: application/json" `
  -d '{\"source\":\"advisor_chat\",\"message\":\"cuanto cuesta\",\"language\":\"es\"}'

# Sin consentimiento → 400
curl.exe -s -o NUL -w "%{http_code}`n" -X POST https://plan-comercial-tipo-relevance-ai.pages.dev/api/lead `
  -H "Content-Type: application/json" -d '{\"email\":\"a@b.com\"}'
```

---

## Prueba local (sin desplegar)

```powershell
cd "C:\Users\Ricardo\Desktop\A2A Project 2027\Plan Comercial tipo Relevance AI"
npx --yes wrangler@4 pages dev
```

Wrangler lee `wrangler.toml`, sirve `public/` y ejecuta `functions/`.
Los secretos locales se toman de `.dev.vars` (creado a partir de `.env`,
nunca se versiona).

---

## Qué hace el endpoint `/api/lead`

1. **`source: "advisor_chat"`** → responde texto guiado. No guarda datos personales.
2. Cualquier otro origen → exige `consent: true` y un correo válido.
3. Guarda en Airtable y/o KV; si ambos fallan, responde `503` (no finge éxito).
4. Envía aviso por Resend si `RESEND_API_KEY` existe.
5. Devuelve `registration.status = "RECORDED"`, `requestId` y
   `assignment.owner = "RSI-01"` (lo que espera la recepción guiada del sitio).
6. Límite básico: 12 solicitudes por IP cada 10 minutos; cuerpo máximo 24 KB.

---

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| El formulario dice “No pudimos registrar” | Falta el almacén o la clave es incorrecta. Revisa **Functions → Logs** en Cloudflare. |
| `503 STORAGE_NOT_CONFIGURED` | No hay Airtable ni KV configurados (Paso 2). |
| Airtable responde `422` | La tabla no tiene las columnas esperadas; el endpoint reintenta con las columnas mínimas (`Nombre`, `Correo`, `Empresa`, `Tarea`, `Consentimiento`). |
| No llega el correo | Revisa spam. En modo de prueba Resend solo entrega a `rick28191@gmail.com`; para otros destinos hay que verificar un dominio. |
| La URL tiene un sufijo distinto | Cloudflare añade sufijo si el nombre está ocupado. Renombra el proyecto o actualiza canonical/sitemap. |

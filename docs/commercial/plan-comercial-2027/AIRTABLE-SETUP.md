# Airtable — dónde se guardan las solicitudes

Actualizado: 2026-11-06

El formulario escribe en **Airtable** mediante el endpoint `/api/lead`
(Cloudflare Pages Function). Hay dos formas de dejarlo listo.

---

## Opción 1 · Usar el CRM que ya existe (recomendada)

La cuenta de Airtable ya tiene la base **Boltech CRM** con la tabla **Leads**.
No hay que crear nada: solo copiar tres datos al panel de Cloudflare.

| Variable en Cloudflare | Valor |
|---|---|
| `AIRTABLE_API_KEY` | token `pat…` de la cuenta |
| `AIRTABLE_BASE_ID` | `appCQZd0IhBHFoZ9P` |
| `AIRTABLE_TABLE_ID` | `tblZaox2MX5uYA5PZ` |

Qué escribe el endpoint en esa tabla:

| Campo del CRM | Contenido |
|---|---|
| `Name` | Nombre de la persona (o el correo si no lo escribió) |
| `Contact Email` | Correo |
| `Status` | `To do` |
| `Source` | `Website` |
| `Commercial Stage` | `Researching` |
| `Pain Categories` | `Workflow Automation` |
| `Consent to Share` | marcado (consentimiento otorgado) |
| `Notes` | Empresa, cargo, tarea, activo, página, referencia y texto del consentimiento |
| `Next Action` | “Revisar la solicitud y responder por escrito con la evaluación.” |

El endpoint no toca importes, cotizaciones ni estados de pago.

> El token debe tener acceso a la base **Boltech CRM**. Si el token solo ve otras
> bases, Airtable responde `403` y el endpoint lo registra en **Functions → Logs**.

---

## Opción 2 · Crear una base nueva solo para leads

Útil si prefieres separar los leads del CRM.

1. https://airtable.com → **Add a base** → **Start from scratch** → nombre `Boltech Leads`.
2. Renombra la tabla a `Leads` y crea estas columnas:

| Columna | Tipo |
|---|---|
| Nombre | Texto de una línea |
| Correo | Correo electrónico |
| Empresa | Texto de una línea |
| Cargo | Texto de una línea |
| Tarea | Texto largo |
| Activo | Texto de una línea |
| Idioma | Texto de una línea |
| Fuente | Texto de una línea |
| Página | URL |
| Consentimiento | Casilla |
| Fecha consentimiento | Fecha |
| ID solicitud | Texto de una línea |

3. Copia el **Base ID** (`app…`) de la URL de la base y el **Table ID** (`tbl…`)
   de la URL de la tabla.
4. Crea un token en https://airtable.com/create/tokens con los permisos
   `data.records:write` (y `schema.bases:read` si quieres validar la tabla).
5. Configura en Cloudflare `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` y
   `AIRTABLE_TABLE_ID` (o `AIRTABLE_TABLE_NAME=Leads`).

El endpoint detecta el esquema: primero intenta el del CRM, luego el genérico y
por último un mínimo de tres columnas. Así funciona con cualquiera de las dos
opciones sin cambiar código.

---

## Comprobar que escribe

1. Envía el formulario de `/solicitud` con consentimiento marcado.
2. Debe responder “Solicitud registrada”.
3. La fila aparece en la tabla con el `Notes` que incluye la referencia
   `WEB-…` que devolvió el endpoint.
4. Si no aparece, revisa **Cloudflare → tu proyecto → Functions → Logs**
   (busca `[airtable]`).

---

## Nota sobre privacidad

- El formulario no pide presupuesto, teléfono, tamaño de empresa ni plazo.
- Solo se escribe con `consent: true`; sin consentimiento el endpoint responde
  `400 CONSENT_REQUIRED`.
- Las solicitudes se conservan según `docs/CONSERVACION-DATOS.md` y pueden
  retirarse escribiendo a `ricardo.boltechgroup@gmail.com`.

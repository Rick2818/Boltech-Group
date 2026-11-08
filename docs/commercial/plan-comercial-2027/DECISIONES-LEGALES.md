# Tres decisiones legales — hoja para decidir

Fecha: 2026-11-05 · Estado: `DECIDED` (2026-11-05, propietario)
Esto **no es asesoría legal**. Es una hoja para que Ricardo elija con consecuencias claras a la
vista. Un profesional puede revisarla después; el agente no puede certificar cumplimiento.

Ninguna solicitud real se recibe mientras las tres filas estén sin decidir.

---

## Decisión 1 — ¿Dónde caen los datos de una solicitud?

| Opción | Qué implica | Costo | Riesgo |
|---|---|---|---|
| **A. Hoja de cálculo privada** (Google Sheets) | Una hoja con nombre, correo, empresa, tema y consentimiento. Acceso solo de Ricardo. | US$0 | Sin control fino de acceso; el enlace mal compartido expone todo |
| **B. Base de datos propia** (Supabase) | Tabla con permisos por fila y registro de cambios. | US$0 en plan gratuito | Requiere configuración y respaldo; el plan gratuito tiene límites |
| **C. CRM** (HubSpot) | Contacto creado con su etapa y notas de cualificación. | US$0 en plan gratuito | El CRM trata datos personales: hace falta política de retención |
| **D. Correo solamente** | La solicitud llega a un buzón y se responde desde ahí. | US$0 | Sin estructura, sin métricas de embudo y sin trazabilidad |

**Recomendación del agente:** opción **A** para las primeras tres conversaciones (mínima
infraestructura, se borra fácil), con migración a **B** en cuanto haya más de diez solicitudes.

**Decide Ricardo:** _______

---

## Decisión 2 — ¿Con qué base legal se contacta?

| Opción | Cuándo sirve | Qué exige |
|---|---|---|
| **A. Consentimiento explícito** (casilla del formulario) | La persona deja su correo y marca la casilla | Guardar prueba del consentimiento y permitir retirarlo |
| **B. Interés legítimo** | Contacto comercial B2B con relación previa | Evaluación documentada y derecho de oposición visible |
| **C. Mixta** | Consentimiento para el formulario; interés legítimo para seguimiento B2B | Las dos anteriores, bien separadas |

**Recomendación del agente:** opción **A**. Es la única que el formulario ya implementa
(`consentToContact` obligatorio) y la que no exige justificar nada más.

**Decide Ricardo:** _______

---

## Decisión 3 — ¿Quién es el encargado del tratamiento?

| Opción | Qué implica | Riesgo |
|---|---|---|
| **A. Solo Ricardo** | Los datos no salen de sus cuentas. Sin terceros. | Depende de una sola persona; sin respaldo formal |
| **B. Ricardo + proveedor de infraestructura** | Hosting y base de datos tratan datos por cuenta de Ricardo | Hace falta un contrato o términos de encargo con ese proveedor |
| **C. Ricardo + agente automatizado** | El agente registra y ordena, pero no decide | El agente no puede ser encargado: no tiene personalidad jurídica; solo ejecuta |

**Recomendación del agente:** opción **B** cuando exista publicación; hoy, **A**.

**Decide Ricardo:** _______

---

## Cuarto bloqueo, distinto de los legales — publicación

| Qué falta | Por qué bloquea |
|---|---|
| Dominio | Sin dominio no hay URL estable para el aviso de privacidad |
| Hosting | Sin hosting no hay formulario que reciba nada |
| Autorización explícita | `publishingEnabled: false` en la configuración |

Publicar exige las tres decisiones de arriba **más** una autorización escrita de Ricardo. El
agente no publica.

---

## Qué cambia cuando las tres estén decididas

| Antes | Después |
|---|---|
| `provenance: synthetic` solamente | Se admite `provenance: real` con consentimiento |
| Métricas en cero | Las métricas empiezan a medir negocio real |
| Fichas sin destino | Cada solicitud tiene dónde registrarse |
| Nada publicado | Se puede publicar con aviso de privacidad enlazado |

---

## Firma de la decisión

| Decisión | Opción elegida | Fecha | Aprobó |
|---|---|---|---|
| Destino de datos | Hoja de cálculo privada | 2026-11-05 | Ricardo |
| Base legal | Consentimiento explícito (casilla del formulario) | 2026-11-05 | Ricardo |
| Encargado de tratamiento | Solo Ricardo | 2026-11-05 | Ricardo |
| Autorización de publicación | **Sí** (merge #342, Vercel production) | 2026-11-05 | Ricardo |

---

## Registro de la decisión

Decidido por Ricardo el 2026-11-05:

1. **Destino:** hoja de cálculo privada. Una sola persona con acceso. Migrar a base de datos
   propia (Supabase) cuando existan más de diez solicitudes.
2. **Base legal:** consentimiento explícito. La casilla del formulario es obligatoria, no está
   premarcada y se registra junto con la solicitud.
3. **Encargado del tratamiento:** solo Ricardo. No hay terceros procesando datos hoy.
4. **Publicación:** no autorizada todavía. Falta dominio y hosting.

Estado de los textos que acompañan a estas decisiones (redactados el 2026-11-05):

| Texto | Redactado | Aprobado | Publicado |
|---|---|---|---|
| Aviso de privacidad (`docs/AVISO-PRIVACIDAD.md`) | Sí | **Sí** (propietario) | No |
| Retiro del consentimiento (`docs/RETIRO-CONSENTIMIENTO.md`) | Sí | **Sí** (propietario) | No |
| Plazo de conservación (`docs/CONSERVACION-DATOS.md`) | Sí | **Sí** (propietario) | No |

Lo que **sigue** bloqueando la captura real:

- ~~Aprobar los tres textos.~~ Hecho el 2026-11-05 por el propietario, sin revisión legal externa.
- Publicar el aviso en una URL estable (necesita dominio).
- Operar el canal de retiro en el buzón real.
- Crear en la hoja la columna de fecha de borrado prevista.
- Revisión por un profesional si se publica y se reciben datos de personas fuera de Bolivia.

**Aprobación del 2026-11-05:** Ricardo aprobó los tres textos como propietario y asumió el
riesgo de no contratar revisión legal externa. La aprobación cubre el texto, no la publicación.
El agente no certifica cumplimiento legal; solo deja constancia de lo decidido.

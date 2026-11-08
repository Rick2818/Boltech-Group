# Auditoría del sitio real — boltech-group.vercel.app

Fecha: 2026-11-05 · Fuente: sitio en producción + repositorio público `Rick2818/Boltech-Group`
Tipo: observación de página pública. No es evidencia REA certificada y no incluye datos privados.

---

## Qué se revisó

| Elemento | Resultado |
|---|---|
| Home | 6 especialidades, 3 formas de empezar, precios de referencia, CTA a `mailto:` |
| `/specialist.html` | Chat interactivo por especialidad, voz, bilingüe |
| `/gmail-privacy` | Aviso de la integración Gmail (Google API Limited Use) |
| `/api/lead` | Endpoint existente: recibe `email`, `companyName`, `painPoint` |
| `vercel.json` | `cleanUrls: true`; 27 rewrites; sin ruta de formulario |
| Pie de página | Solo enlaza a `/gmail-privacy` |

---

## Hallazgos, por prioridad

### P0 — Bloquea recibir una solicitud de forma responsable

| # | Hallazgo | Evidencia | Efecto |
|---|---|---|---|
| 1 | **No hay formulario.** El único CTA es `mailto:` | Home, sección `#contact` | No se registra consentimiento ni atribución; no hay embudo medible |
| 2 | **No hay aviso de privacidad del sitio** | El pie enlaza a `/gmail-privacy`, que trata solo la integración de Gmail | Quien envía una solicitud no sabe qué pasa con sus datos |
| 3 | **No hay canal de retiro** | No existe página ni palabra clave | El consentimiento no es revocable en la práctica |
| 4 | **No hay plazo de conservación** | No existe página | Se guarda sin límite declarado |
| 5 | **`api/lead.js` no exige consentimiento** | El código acepta `email`, `companyName`, `painPoint` | Cualquier POST sin consentimiento genera un lead |

### P1 — Alineación con el plan aprobado

| # | Hallazgo | Efecto |
|---|---|---|
| 6 | **Falta la primera puerta de Operaciones** | Las 3 tareas aprobadas no aparecen en el sitio |
| 7 | **No hay estado de integraciones** | El sitio dice "requieren autorización y certificación", sin lista ni estado |
| 8 | **El paso 2 del proceso dice "revisamos presupuesto y plazo"** | Sugiere que se piden en el primer contacto; el plan los descubre después, por escrito |
| 9 | **No hay criterio de aceptación visible** | El comprador no sabe cómo se va a medir la entrega |

### P2 — Consistencia y confianza

| # | Hallazgo | Efecto |
|---|---|---|
| 10 | **Dos avisos de datos conviven sin enlace entre ellos** | `/gmail-privacy` menciona Airtable y Redis; el plan decidió hoja de cálculo privada |
| 11 | **`/solicitud` no existe en el sitemap** | Las páginas nuevas no se descubrirían |
| 12 | **La confirmación por correo promete "Solución de Proceso Lento"** | Copy no alineado con la evaluación por escrito |

---

## Qué sí está bien y se conserva

- **Seis especialidades con un agente cada una**, exactamente el mecanismo clonado.
- **Precios de referencia con la nota "no ofertas finales"**, que el mecanismo permite.
- **Bilingüe real** en la home y en el chat.
- **Chat con voz** y aviso de que no hay acciones externas certificadas.
- **Aviso de Gmail** con lenguaje de Limited Use.
- **`cleanUrls`** ya configurado: las páginas nuevas funcionan sin tocar rutas.

---

## Qué se preparó

| Pieza | Archivo | Cubre |
|---|---|---|
| Formulario de 6 campos + consentimiento | `site/solicitud.html` | Hallazgos 1, 7, 9 |
| Aviso de privacidad | `site/privacidad.html` | Hallazgo 2 |
| Retiro del consentimiento | `site/retiro.html` | Hallazgo 3 |
| Conservación de datos | `site/conservacion.html` | Hallazgo 4 |
| Sección de las 3 tareas | `site/home-operaciones.html` | Hallazgo 6 |
| Parche de `api/lead.js` | `site/README.md` | Hallazgo 5 |

---

## Lo que no se puede resolver desde aquí

- **Destino real de los datos**: `/gmail-privacy` dice Airtable; la decisión aprobada dice hoja
  privada. Hay que elegir uno y alinear el aviso.
- **Publicación**: requiere autorización explícita y aplicar los cambios en
  `Rick2818/Boltech-Group`.
- **Verificación posterior**: probar el formulario en producción con un correo propio y comprobar
  que el consentimiento queda registrado.

---

## Criterio de terminado

El sitio cumple cuando:

1. `/solicitud` registra nombre, correo, empresa, cargo, tarea y consentimiento.
2. Sin consentimiento, el registro se rechaza.
3. `/privacidad`, `/retiro` y `/conservacion` están enlazadas desde el formulario y el pie.
4. Las 3 tareas de operaciones aparecen en la home con su criterio de aceptación.
5. El sitemap incluye las cuatro rutas.
6. El correo de confirmación no promete resultados ni precios.

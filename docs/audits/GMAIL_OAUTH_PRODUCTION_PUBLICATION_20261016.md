# Publicación OAuth de Boltech Group — 16 octubre 2026

## Resultado comprobado

Tras autorización expresa de Ricardo para publicar los textos y, después, para cambiar el modo de Google Cloud, el proyecto `boltech-group-gmail-oauth` muestra **En producción**. Se confirmó mediante la página Público de Google Auth Platform el 16 octubre de 2026, aproximadamente 12:28–12:30 de El Salvador.

Google muestra además: **Tu app requiere una verificación**. Publicación y verificación no son equivalentes. No se presentó una solicitud de revisión ni se afirma aprobación de los permisos de Google.

## Sitio y controles

- PR #98 integrado: https://github.com/Rick2818/Boltech-Group/pull/98
- Commit: `199826188867678515ece108dcb0a5cd48ef1785`.
- Controles del head revisado `c7b762b798c707b31451163caa455e0a899c5100`: contracts, governance y followup-safety aprobados.
- Vercel Production `dpl_7FFxYx2g6dTn5pvuKVmCvZq7NQgR`: READY, commit correcto.
- https://boltech-group.vercel.app/gmail-privacy y https://boltech-group.vercel.app/gmail-terms: HTTP 200. Ambos enlaces presentes en la página principal, también HTTP 200.
- Página, dominio y los dos enlaces guardados en Google Cloud. Tras guardar privacidad y condiciones, Publicar app dejó de estar deshabilitado. Luego se confirmó el cambio de modo autorizado.
- Diff de publicación limitado a esas dos páginas, enlaces en index.html y documento diagnóstico. Wompi, pagos, secretos y configuración Vercel sin cambios en ese PR.

## Pendiente y límites

No se sustituyó el refresh token de Vercel. El último rechazo conocido sigue siendo `GMAIL_OAUTH_INVALID_GRANT`. Publicar la aplicación no repara ni revive por sí solo un token inválido. La causa precisa del rechazo anterior sigue sin demostrarse.

Se preparó OAuth Playground con **Use your own OAuth credentials**, flujo Server-side, endpoints Google, Offline y Consent Screen. Se copió el Client ID del cliente propio observado en Google Cloud. El Client secret está pendiente de entrada por Ricardo: los secretos existentes no son recuperables en claro desde la consola. No se creó ni eliminó un secreto.

Próximo paso: el titular introduce el secreto guardado del mismo cliente, renueva la autorización de su cuenta corporativa y conserva los tokens en sus almacenes autorizados. Después, actualizar el refresh token correcto de producción, redesplegar y ejecutar el workflow de verificación sin outreach. Certificar renovación y perfil contra el despliegue actual, conservando recibo. No enviar campañas ni declarar autonomía funcional a partir de READY o de esta publicación.

La restricción documentada de siete días del modo Testing deja de ser la configuración para nuevas autorizaciones emitidas en producción; no prometer tokens eternos ni ausencia de futuras revocaciones.

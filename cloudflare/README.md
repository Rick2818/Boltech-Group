# Parche para el frontend vigente de Cloudflare

`public/sales-agent.html` parte del archivo servido en boltech-group.pages.dev el 7 de noviembre de 2026. Solo añade identificador de petición y progreso si la API devuelve el contrato `conversion`.

Este directorio no contiene el Worker privado ni todos los activos del sitio. No subirlo como reemplazo completo de producción. Integrarlo al paquete vigente una vez recuperado con acceso autorizado a Cloudflare. Reutilizar `lib/leo_conversion_guide.js` para la política portable; adaptar el almacenamiento a los bindings reales del Worker, sin exponer secretos en el navegador.

Ver `docs/ops/LEO_CONVERSION_GUIDE_20261107.md` para los límites, pruebas y pasos pendientes de publicación.

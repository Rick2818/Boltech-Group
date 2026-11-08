# Brief — rediseño UX/UI de la landing (para el agente de diseño)

## Estado actual
- Landing en `src/funnel.mjs` → `renderFunnelHtml` (una sola página, ES/EN) + páginas programáticas (`agentes/`, `especialidades/`, `vs/`, etc.).
- Estilo actual: CSS plano en `SITE_CSS` (system-ui, paleta #1a56db sobre blanco, sin animación, sin imágenes).
- El usuario lo considera "demasiado plano, sin vida". Objetivo: moderno, tecnológico, con vida.

## Restricciones que NO se pueden romper
1. No copiar marcas, diseño ni código de terceros (Relevance AI, Boltech, etc.). Solo estructura/mecanismo.
2. Mantener el mecanismo clonado: 8 capas, 11 bloques de landing, 8 bloques por tarea, 6 campos en el form, sin presupuesto/teléfono/tamaño/plazo.
3. Bilingüe ES/EN con par validado (`validateFunnelPair`).
4. SEO intacto: un `<h1>` por página, canonical + hreflang, JSON-LD por plantilla, sitemap/robots/llms.txt. No romper `tests/seo.test.mjs`.
5. Accesibilidad: contraste AA, foco visible, navegación por teclado, `prefers-reduced-motion`.
6. Sin dependencias externas en runtime (sin CDN, sin fonts remotas, sin JS de terceros). Todo self-contained.
7. Performance: CSS/JS inline, sin imágenes pesadas; LCP < 2.5s en móvil.
8. No modificar la lógica de negocio (precios, especialidades, validadores). Solo presentación.

## Entregables esperados
- `SITE_CSS` renovado + animaciones CSS (keyframes) con respeto a `prefers-reduced-motion`.
- Posible micro-interacción en JS vanilla (progressive enhancement, sin romper sin JS).
- Identidad visual propia de Boltech Group (no la del observado).
- Dark/light opcional, pero si se hace, con toggle persistente en localStorage.
- Capturas de ES y EN en escritorio y móvil para el PR.
- Tests existentes siguen verdes (`npm test`, `npm run check`).

## Punto de entrada para el agente
- Skill a cargar: `frontend-design`.
- Archivos clave: `src/funnel.mjs` (SITE_CSS, renderFunnelHtml, renderSubPageHtml), `config/funnel.json`, `config/funnel.en.json`.
- Build de referencia: `.clonador/funnel/build-CntEZk/` (74 archivos).
- Servidor local: `node .clonador/seo/serve-8793.cjs` (puerto 8793) — o recrear con el script de la sesión.

## Prompt listo para pegar al agente de diseño
> Eres un diseñador UX/UI con 20 años de experiencia. Rediseña la landing de Boltech Group (ES/EN) que está en `src/funnel.mjs` (`SITE_CSS` y los renderers). Debe verse moderna, tecnológica y con vida, manteniendo la estructura clonada (8 capas, 11 bloques, 6 campos en el form), bilingüe, SEO intacto y todos los tests verdes. No copies diseño ni código de terceros. Entrega capturas ES/EN en desktop y móvil. Empieza por `frontend-design`.

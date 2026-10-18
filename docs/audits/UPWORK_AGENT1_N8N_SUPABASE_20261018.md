# Upwork → Agent 1, n8n y Supabase — verificación

Fecha: 2026-10-18 16:13 America/El_Salvador
Worktree: `codex/upwork-n8n-supabase-20261018`
Commit base sincronizado: `014e961fc7ce65ebe2d9ff755b127d8c25fea601`

## Resultado comprobado

- Git se avanzó por fast-forward hasta `origin/main` en el worktree aislado. La carpeta principal y su rama `main` no se modificaron.
- El callback público `https://boltech-group.vercel.app/api/upwork/callback` responde `UPWORK_CALLBACK_READY`, pero comunica `credentialsConfigured=false` y `agent1Connected=false`.
- La batería existente `tests/test_upwork_oauth.mjs` terminó con 13/13 pruebas aprobadas. Verifica autorización, estado/replay, intercambio simulado y cifrado del token; no verifica conexión OAuth real.
- El ejecutor existente de Agent 1 conserva Upwork y n8n desactivados y no implementa sus adaptadores. No se realizó scraping, propuesta, contacto ni escritura comercial.
- La instancia local n8n respondió HTTP 200 en `/healthz` y `/rest/settings`; `/rest/credentials` y `/rest/workflows` respondieron 401. No se pudo verificar desde esa API la configuración activa ni vincular credenciales.
- Airtable respondió; Boltech CRM contiene 9 tablas y 545 registros en el snapshot consultado. El proyecto Supabase `iocwkuvkjeyonqosetvj` está `INACTIVE`; su restauración fue rechazada por el límite de proyectos Free activos. No se cambiaron tablas ni datos.
- No se mostraron, copiaron ni escribieron secretos, ni se alteró una configuración de pago.

## Puertas del diagnóstico inicial (histórico; alcance actualizado abajo)

- Upwork: el uso comercial de su API requiere permiso escrito previo para un partner seleccionado. La API documenta la búsqueda pública de postings con el permiso `Read public marketplace Job Postings`; la clave OAuth y el permiso deben existir antes de activar el adaptador de Agent 1. Fuente: https://support.upwork.com/hc/en-us/articles/17995890765459--Commercial-API-use y https://www.upwork.com/developer/documentation/graphql/api/docs/index.html.
- n8n: para el ejecutor cloud se requiere un endpoint HTTPS autenticado y accesible desde GitHub Actions. El servicio local `127.0.0.1:5678` no satisface esa ruta; no se abrió túnel ni se creó hosting.
- Supabase: la migración de datos requiere que el proyecto de destino esté activo. No se pausó ningún otro proyecto ni se seleccionó un proyecto distinto sin autorización del propietario.

La conclusión inicial de Upwork API y de n8n Cloud fue reemplazada por la aclaración posterior: ambas fuentes se destinan a trabajo freelance. El flujo actual es Upwork MCP oficial más el tablero público n8n Community Jobs; el proyecto Supabase sigue siendo un asunto separado.

## Siguiente acción del diagnóstico inicial (histórica; sustituida abajo)

Ricardo confirma el permiso/API key comercial de Upwork y deja `UPWORK_CLIENT_ID` y `UPWORK_CLIENT_SECRET` en el almacén seguro de Vercel; los tokens OAuth permanecen en Redis cifrado. Después se añade y verifica el adaptador de lectura de postings para Agent 1. Para n8n y Supabase se usa únicamente un endpoint/proyecto activo ya autorizado, sin agregar costos ni pausar proyectos desconocidos.

## Actualización por alcance freelance — 2026-10-18 16:33 America/El_Salvador

Ricardo aclaró que Upwork y n8n se usarán para descubrir trabajo freelance para Boltech, no para captar compradores del piloto comercial. Las oportunidades quedan separadas de `Leads`, de la calificación de compradores y de RSI-02/03. La revisión, selección y cualquier propuesta siguen siendo pasos humanos dentro de cada plataforma.

- **n8n Community Jobs**: habilitado como fuente pública de solo lectura en Agent 1 mediante `GET https://community.n8n.io/c/jobs/13.json?page=0`. La lectura comprobó categoría 13 y 30 temas; 15 tuvieron señal de contratación y 5 incluyeron señal explícita de freelance/contrato. Siete candidatos se marcaron antiguos y todos requieren revisar vigencia y encaje; no se presentan como vacantes activas sin esa revisión. No usa credenciales de n8n Cloud y no modifica foro, CRM ni workflow.
- **Guardas de acción**: el recibo de Agent 1 separa `freelanceOpportunities` de buyer leads e indica `proposalsSubmitted=false`, `externalMessagesSent=false` y `connectsUsed=0`. No se envió mensaje ni propuesta.
- **Upwork**: para esta finalidad se usará el MCP oficial [`https://mcp.upwork.com/mcp`](https://www.upwork.com/ai/mcp) con OAuth 2.1, no scraping ni la API comercial. La página oficial confirma compatibilidad con Codex y búsqueda de trabajos. El runtime de Agent 1 aún no tiene una autorización MCP OAuth activa ni un adaptador conectado. La autorización interactiva no se pudo realizar en esta sesión porque el navegador local está deshabilitado; no se solicitó ni expuso contraseña o token.
- **Verificación**: 8/8 pruebas del flujo de Agent 1 aprobaron usando solamente `config/qa_case.json`; se actualizaron fixtures heredados para dejar de crear identidades ficticias. Sintaxis Node válida. La lectura en vivo del tablero n8n fue GET pública, sin credenciales ni efectos externos. [Tablero oficial de empleos de la comunidad n8n](https://community.n8n.io/c/jobs/13).
- **n8n Cloud** sigue siendo distinto del foro: la API local conserva el resultado 401 al leer workflows/credentials. No se desplegó ni habilitó un workflow cloud, pues la aclaración define n8n como fuente de oportunidades freelance.
- **Supabase**: el destino `iocwkuvkjeyonqosetvj` permanece `INACTIVE`; no se migraron registros y no se pausó otro proyecto. El cambio de esta actualización se limitó a la fuente de oportunidades.
- **Git**: la copia principal `main` no se modificó. La actualización quedó publicada en `origin/codex/upwork-n8n-supabase-20261018` después de las verificaciones locales.

Siguiente acción indispensable de cuenta: completar la autorización del MCP oficial de Upwork dentro del runtime que ejecutará Agent 1, limitada a búsqueda/lectura; mantener bloqueadas las herramientas de propuesta, mensajes y contratos. No compartir secretos por chat. El n8n Community Jobs feed sí queda listo con lectura pública.

## Actualización Flova MCP — 2026-10-18

Se verificó la documentación oficial de [Flova MCP](https://www.flova.ai/en/docs/features/integrations/mcp/) y la integración del agente existente `marketing-director`. La identidad y las reglas de revisión de storyboard, consumo de créditos y publicación ya están documentadas en `.agents/agents/marketing-director.md` y `docs/marketing/FLOVA_AGENT_HARNESS_2026-10-18.md`.

- La sesión de Codex no tiene una herramienta ni un conector Flova habilitado; la búsqueda del directorio de plugins tampoco encontró un conector instalable. `.agents/mcp_config.json` no contiene Flova. La documentación oficial indica que la primera conexión debe iniciarse desde los ajustes MCP del cliente y completar autorización de cuenta.
- No se inventó ni añadió una URL de servidor: la documentación pública instruye a usar la información de conexión proporcionada por Flova en el cliente. No se generó ni subió contenido y no se consumieron créditos.
- El navegador local de esta sesión permanece deshabilitado, así que el flujo de inicio de sesión/autorización no se pudo completar desde aquí. La cuenta debe habilitar el conector oficial de Flova MCP en Codex y completar su autorización; luego se podrá comprobar la lectura real de un proyecto con el agente de mercadeo.

## Estado de datos y sincronización

- La lectura actual de esquema Airtable volvió a confirmar las nueve tablas de Boltech CRM. No se exportaron filas privadas al repositorio.
- Supabase volvió a reportar el único proyecto `iocwkuvkjeyonqosetvj` como `INACTIVE`. La restauración anterior había sido rechazada por el límite de proyectos Free activos; no se pausó otro proyecto ni se eligió un destino distinto, y no se copió ningún registro.
- El commit `b4e664225a4d3012951fa11b603b90ddfe6eecef` está publicado en la rama aislada `origin/codex/upwork-n8n-supabase-20261018`; `origin/main` sigue en `014e961fc7ce65ebe2d9ff755b127d8c25fea601`.

## Corrección solicitada de Agent 1 — 2026-10-18

- Se reemplazó el `source('upwork', false, ...)` por un adaptador MCP remoto al endpoint oficial `https://mcp.upwork.com/mcp`, usando el SDK MCP del proyecto y su flujo OAuth 2.1 con registro dinámico, PKCE y renovación del SDK.
- El workflow de Agent 1 ahora recibe `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` y `UPWORK_MCP_VAULT_KEY`; el runtime guarda información OAuth, verificador PKCE, estado de descubrimiento y tokens en Upstash Redis cifrados con AES-GCM. No se usa el callback de API de Upwork para autorizar el MCP.
- `scripts/commercial/upwork_mcp_authorize.mjs` permite iniciar la autorización desde el runtime local autorizado, devolver al callback loopback y validar un handshake real antes de persistir la sesión compartida que consumirá GitHub Actions. El enlace OAuth es de uso único y debe ser aprobado por Ricardo en Upwork.
- Agent 1 solo invoca herramientas MCP que se declaran `readOnlyHint=true`, no destructivas, con nombre de búsqueda/lectura de postings y esquema de consulta compatible. Oportunidades quedan separadas de leads compradores; no envía propuestas, mensajes, contratos ni consume Connects.
- El callback público anterior queda identificado como `UPWORK_DEVELOPER_API_OAUTH_NOT_MCP` y comunica `agent1McpConnected=false`; los valores vacíos de Client ID/Secret de la API dejaron de confundirse con la autorización del servidor MCP.
- La corrección todavía no certifica el runtime productivo: hace falta que los tres secretos de workflow estén configurados en GitHub Actions y completar una vez `node scripts/commercial/upwork_mcp_authorize.mjs` con el navegador/cuenta Upwork de Ricardo. Después, ejecutar el workflow existente y verificar en su artefacto `sources.upwork.status=OBSERVED`, `toolName`, y oportunidades reales de postings; si el token expira, la renovación se conserva en Redis.
- Validaciones sintéticas y de contrato usan exclusivamente `config/qa_case.json`. La ejecución en vivo de autorización no se ha realizado y no se afirma OAuth conectado hasta verificar handshake y relectura desde Actions.

Verificación de la corrección técnica — 2026-10-18 17:13 America/El_Salvador:
- Se validaron los imports reales de MCP SDK 1.30.1 (`@modelcontextprotocol/sdk/client` y `.../client/streamableHttp.js`); el transporte HTTP quedó probado contra el paquete instalado.
- Las pruebas específicas de Agent 1, OAuth y guardas aprobaron 27/27.
- El preflight consulta el vault cifrado de Upstash y distingue secretos presentes de una autorización MCP persistida. En este runtime reporta `RUNTIME_SECRETS_MISSING`, `authorizationStored=false` y `allProvidersReady=false`; no se presenta como conectado.
- La comprobación pública no debe interpretarse como estado del MCP: el callback confirma únicamente que existe la ruta del OAuth Developer API y devuelve explícitamente `UPWORK_DEVELOPER_API_OAUTH_NOT_MCP`.
- La autorización OAuth y la relectura MCP desde GitHub Actions quedan pendientes de la cuenta del operador y de los secretos de repositorio. Hasta completar esa acción, Agent 1 reporta `BLOCKED` para Upwork y el feed público de empleos n8n sigue siendo independiente.

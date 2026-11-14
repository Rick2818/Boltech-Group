# Leo private connections — Cloudflare-only correction

This is the recovered production upload source plus an isolated connection update.
Speech synthesis, voice profile, microphone behavior and payment forwarding are unchanged.

## What changes

- Upwork connects directly to the official `https://mcp.upwork.com/mcp` server.
- Client metadata and the OAuth callback are served by `boltech-group.pages.dev`.
- Public-client OAuth uses PKCE S256 and an encrypted, HttpOnly browser-bound state cookie.
- Access and refresh tokens are encrypted in the existing COMMERCE KV namespace using a
  domain-separated key derived from LEO_PLATFORM_TOKEN. No additional API secret is required.
- Owner authentication gates authorization start, checks and searches. Only `get_account`
  / `get_user_details` and `find_jobs` / `search` can be called by the MCP adapter.
- Upwork appears in the private connection checker and `/upwork <query>` uses bounded reads.
- Explee 403 responses include a safe classification; provider response bodies are never shown.
  This improves diagnostics; it does not override provider permissions or prove Explee is connected.

## Existing requirements

Keep LEO_PLATFORM_TOKEN (24+ characters), COMMERCE KV, and UPWORK_ORG_UID.
UPWORK_CONNECTOR_UID and UPWORK_CONNECT_USER_ID are not used by this direct flow.
Do not delete existing secrets as part of deploying this update.
Rotating LEO_PLATFORM_TOKEN requires authorizing Upwork again because it also protects
its encrypted token record. Token refresh failures fail closed and require reauthorization.

The public client metadata protocol is advertised by Upwork's current OAuth metadata:
https://mcp.upwork.com/.well-known/oauth-authorization-server
The provider can still decline registration or authorization. Passing local tests is not proof of consent.

## Build and test

    node --test tests/test_leo_direct_connections.mjs
    node scripts/build_leo_connections.mjs /tmp/leo-connections-release

Upload only `_worker.js`, `_routes.json` and `sales-agent.html` from that output as a ZIP
in the existing Cloudflare Pages project, Production. The build inlines server modules;
do not upload this source directory directly.

## Production acceptance

1. Complete the upload; do not modify voice or payment bindings.
2. Open Leo's private integrations using the current owner token.
3. Click Conectar Upwork, then Autorizar en Upwork. The owner must review and complete
   Upwork's sign-in/consent screen. No one should paste Upwork tokens into the chat.
4. Return to the original Leo tab and click Verificar conexiones. A stored token alone
   is not enough: CONNECTED requires a successful Upwork account read.
5. Search `/upwork automation` and verify provider job IDs, URLs and the private read receipt.
6. Verify Freelancer still reads its account and inspect Explee's real response separately.

No messages, applications, bids, payments, cron jobs or credit purchases are added.
No consent, provider access, or production deployment has been certified by the isolated tests.

# ASMAS — Credential audit and reuse, 2026-10-12

## Verified live connections
- **Supabase**: ASMAS project `pkgztteqtyebsggxnett` ACTIVE_HEALTHY. Dedicated database and QA tables.
- **Airtable**: `ASMAS V4.1 - Isolated QA` (`appwADonOZJEjwsgg`), create permission. Keep this base isolated from the separate existing CRM.
- **Vercel**: connected account can list projects. Existing `boltech-group` project has production secrets with names corresponding to Gmail OAuth, Redis/Upstash, Airtable, HubSpot, Wompi and Telegram. **Names only confirmed.** No token values inspected, copied, or tested. Existing secrets are not proof that those connectors work for ASMAS.
- **Vercel isolation block**: `asmas-staging` did not exist during audit; previous Vercel project creation returned HTTP 403. Do not add ASMAS secrets to `boltech-group`, and do not reuse live production Redis queues.
- **Gemini**: no `GOOGLE_API_KEY` or `GEMINI_API_KEY` listed among the 27 existing Vercel variables inspected. The provider key might exist elsewhere, but no ASMAS runtime key verified. Mandatory model `gemini-2.5-flash`.
- **Apollo / Gmail**: ChatGPT app connectors available; standalone ASMAS worker credentials/permissions unverified.
- **Github**: feature branch `feature/asmas-v4-1-core` under draft PR #62 accessible.

## Secret reuse policy
1. Reuse existing *accounts and integrations*, but **not production infrastructure shared state**. Access to secrets in ChatGPT connectors does not mean deploy-time access.
2. Use a **new isolated Vercel project** or another ASMAS-only runtime for worker secret injection. A secret may be reused there only after owner/scope check and explicit permission, without displaying it.
3. Gemini: one server-side key for A1-A5; separate keys only if required by key restrictions or lifecycle rotation.
4. Redis: separate database/namespace, preferably an independent Upstash database; never point to `boltech-group` queues.
5. Airtable: dedicated ASMAS QA base with least-privilege token. Keep `AIRTABLE_TOKEN` restricted if it has broad permissions.
6. Gmail: existing OAuth app may be used if scopes, sender identity, refresh ability and authorized access are verified. Real sends remain disabled.
7. Apollo: verify usable account API plan and endpoints before attempting enrichment. Never upgrade spending without approval.
8. Wompi: no live payments until independent webhook tests and explicit go-live approval.
9. Do not commit or print secrets in GitHub, logs, user chat, or docs.

## Current blocker / next execution gates
- Cannot certify existing Vercel keys work; metadata-only audit.
- Must resolve Vercel 403 project creation permission or provision an ASMAS-only alternative.
- Gemini credential for ASMAS runtime not verified; no model API success response.
- Redis actual service binding and five autonomous workers not deployed.
- CI tests and synthetic tests must pass before any activation.

Nothing in this audit authorizes modification to the production Vercel project, GitHub main, or existing production secrets.

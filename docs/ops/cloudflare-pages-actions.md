# Original corporate Pages deployment through GitHub Actions

Target: account `f8c7c411bffaade3f6f0af4384db42e0`, existing project
`boltech-group`, production branch `main`, URL `https://boltech-group.pages.dev`.
This does not deploy the personal-account Worker or create a new project.

One-time owner setup:

1. Create a Cloudflare API token named `Boltech GitHub Pages`, with Account →
   Cloudflare Pages → Edit, restricted to the corporate account above. This is
   account-level Pages access, not a claim of per-project token isolation.
   Do not add DNS, billing, Workers Scripts, Supabase, or provider permissions.
2. Save the token directly into Rick2818/Boltech-Group → Settings → Secrets and
   variables → Actions → New repository secret as `CLOUDFLARE_API_TOKEN`.
   Never place it in chat, code, a workflow literal, an issue, or a PR body.
3. Once the workflow is merged, run `Cloudflare Pages — Leo production` from main.
   Subsequent pushes to main affecting the release files trigger deployment.

The account ID is a fixed non-secret workflow value to prevent accidental
deployment into the personal account. PRs only build and test without secrets.
Production runs validate the exact existing project through the Cloudflare API,
build exactly three public assets, deploy with pinned Wrangler 4.99.0, and compare
the public HTML hash with the commit. A successful run also requires the owner
session endpoint to respond unauthenticated without granting access.

This workflow intentionally uses the canonical root source and the session-aware
gateway, rather than the older independent `cloudflare/pages/src` snapshot.
Existing runtime secrets, COMMERCE binding, provider OAuth records, immutable
backend, and Wompi routes stay in the same Pages project. No secret-sync or
project-configuration commands run. No cron or additional scheduler is created.

Missing/expired token, wrong account scope, unavailable API, wrong production
branch, failed tests, or failed production verification are visible failures.
There is no success fallback or automatic rollback that could overwrite another
release. Browser session creation must be tested by the owner after deployment.

Local validation: release build and JS syntax checks passed; target checks with
isolated fixture credentials confirm the fixed corporate endpoint and rejection
of a missing secret. Real token authorization and production deployment remain
pending until the owner saves the secret and the workflow reaches main.

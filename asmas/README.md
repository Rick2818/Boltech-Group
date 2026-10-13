# ASMAS — isolated synthetic staging

Current route: Supabase task queue + one protected Edge Function + Supabase Cron every 15 minutes. Vercel serves diagnostics. Redis is not required for this route.

Five roles A5 → A1 → A2 → A3 → A4 share Gemini 2.5 Flash; they have distinct task ownership and durable results. No real email or payment tools are enabled.

Worker deployed as `asmas-batch` in dedicated project `pkgztteqtyebsggxnett`. GOOGLE_API_KEY is currently absent and free-tier verification is false: no live model calls occur.

Run tests: `node --test tests/test_asmas*.mjs`. SQL contract test: `asmas/sql/simple-batch-db-test.sql` (ROLLBACK). Apply bootstrap only to the dedicated ASMAS database.

Source: feature/asmas-v4-1-core, draft PR #62, never merge to main as part of staging work.

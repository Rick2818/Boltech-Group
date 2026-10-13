# ASMAS isolated deployment gates — simplified route
Ricardo selected Supabase queue + one Edge Function + Cron on 2026-10-13, to reduce code and keep USD0. This replaces the earlier mandatory Redis/independent-worker plan for synthetic staging.

## Applied
- Dedicated Supabase project pkgztteqtyebsggxnett; no Boltech database.
- Five distinct roles and durable task ownership within one batch host.
- Private functions/tables, scoped endpoint token, idempotency and lease fencing.
- Cron every 15 minutes; independent Vercel diagnostics.
- Unit/CI and database contract tests; live HTTP preflight.

## Still required
1. Configure GOOGLE_API_KEY securely in ASMAS Supabase and verify the Google API project's free tier before enabling model calls.
2. Complete actual A5 → A1 → A2 → A3 → A4 inference for SYN-E2E-001; inspect durable results and receipts.
3. Verify remaining commercial integrations and fault cases separately. Provider inference is not commercial delivery certification.
4. Keep real outbound emails and payments disabled in this staging project.
5. No merge into main and no rollout to Boltech production under this staging authorization.

Redis and a Vercel database secret are not requirements for the simplified route. Offline tests, database test outputs and deployment ACTIVE/READY are not evidence of live model autonomy.

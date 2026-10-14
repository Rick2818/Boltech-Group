# ASMAS — infrastructure checkpoint (2026-10-13)

## Confirmed
- Independent Vercel project created: `asmas-staging` (`prj_DxmA1Phv9x4u5AljUDNVlZbRTPNT`), SSO enabled, no deployment yet.
- Environment names added to staging project: `ASMAS_ENV=staging`, `ASMAS_SUPABASE_PROJECT_REF=pkgztteqtyebsggxnett`, `ASMAS_GEMINI_MODEL=gemini-2.5-flash`, `ASMAS_OUTBOUND_ENABLED=false`, `ASMAS_PAYMENTS_ENABLED=false`.
- Confirmed `asmas-staging` environment presently has no `GOOGLE_API_KEY`, no project-scoped Supabase write secret, and no dedicated Redis credentials. Never copy existing Boltech Redis URL into ASMAS.
- Independent ASMAS Supabase project `pkgztteqtyebsggxnett` remains available; transactional synthetic test completed 5 tasks attributed to A1-A5, then ROLLBACK (not actual autonomous inference).
- Previously completed contract workflow run `38337695612` succeeded, including Gemini runtime offline API mocks. No live Gemini API inference tested.

## Mandatory blockers for operational end-to-end certification
1. Securely provide a valid Google API credential to the independent Vercel runtime (do not print key); verify model is enabled for this Google Cloud project.
2. Provision isolated Redis/Upstash instance and inject secrets into `asmas-staging`, no shared production queues.
3. Provide scoped Supabase server credential, then deploy ASMAS-only worker runtime (currently no deployment).
4. Execute actual five-agent Gemini inference across broker and DB, audit messages/events; verify 15 fault cases.
5. Keep all outbound contact/payment methods disabled in synthetic staging.

Do not claim production readiness, actual agent autonomy, or five independent real-model executions from the transactional SQL test.

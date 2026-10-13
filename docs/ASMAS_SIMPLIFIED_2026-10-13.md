# ASMAS simplified runtime — 2026-10-13
This supersedes the earlier Redis-dependent staging plan following Ricardo's instruction to reduce code and keep the budget at USD0.

## Applied and verified
- Existing Supabase project pkgztteqtyebsggxnett; no additional account or subscription.
- Reused tasks, activities, messages, outbox and synthetic_runs.
- Added only one private runtime settings row and task lease token/result columns.
- One Edge Function asmas-batch; five roles with shared bounded runtime.
- pg_cron + pg_net enabled; asmas-batch-15m active every 15 minutes.
- Custom endpoint authentication uses a scoped token stored in Vault, validated server-side by digest. POST without token returned 403.
- Authorized POST reached the deployed function and database; returned 503 BLOCKED_GOOGLE_API_KEY with zero model calls.
- Public GET exposes readiness only; returned 503 BLOCKED_GOOGLE_API_KEY.
- Database transaction test passed five-role handoffs, duplicate start/commit rejection, lease fencing, durable outbox and private access; all test results ROLLBACK.
- 15 relevant local tests passed, including five new host tests. Gemini unit calls are mocked, not live evidence.
- One real queued fixture: SYN-E2E-001, run 85526f85-0d36-4c01-87bd-2085ce89fa09, pending A5. No fake inference results persisted.
- No outbound email, payment or production Boltech changes.
- No Redis changes from the abandoned route were published.
- Model requests capped at 1024 output tokens, thinking budget 0, 18-second request timeout; batch bounded to five tasks and a 50-second admission deadline.
- Private-schema RLS/no-policy advisor INFO is intentional: no anon/authenticated table or function grants.

## Remaining configuration
1. Set GOOGLE_API_KEY securely in the ASMAS Supabase Edge Function secrets. It is not needed in Vercel for this architecture.
2. Verify that the Google project uses the free API tier with no billed consumption; only then set asmas.simple_runtime.google_free_tier_verified=true.
3. Invoke the protected worker or let Cron resume the pending fixture, then inspect five provider results, task receipts, messages and run result.
4. Real inference does not certify the entire commercial flow. Vendor integrations and the remaining fault scenarios still need independent verification.

Redis and an additional Vercel server credential are no longer prerequisites. Commercial certification remains false. A SQL contract test, mock, deployed function or READY state is not a live five-agent model execution.

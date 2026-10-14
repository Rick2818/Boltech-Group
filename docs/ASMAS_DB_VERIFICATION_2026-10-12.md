# ASMAS Database migration report — 2026-10-12

**Project:** ASMAS / pkgztteqtyebsggxnett (exclusive project).

**Verified:** first migration created asmas.opportunities, asmas.tasks, asmas.outbox, asmas.activities. Follow-up migration added asmas.agent_registry, asmas.leads, asmas.messages, asmas.incidents, asmas.synthetic_runs, asmas.claim_task and asmas.complete_task.

**Evidence:** Supabase migration API returned success for both migrations; SQL queries enumerated initial four tables; INSERT/UPSERT and SELECT confirmed exactly five agent registry records and one synthetic fixture. Atomic claim + complete task was run in a transaction and returned SUCCEEDED before ROLLBACK. This is a database contract verification, not a multiagent E2E deployment.

**Still absent:** durable Redis connection, live SDK agents, autonomous workers, database-connected cloud runtime, MCP operational auth, payment simulation webhooks, 15 live fault-injection tests. Avoid stating that ASMAS is production-ready.

**Isolation:** work only on feature/asmas-v4-1-core, PR #62 remains draft. Do NOT merge to main.

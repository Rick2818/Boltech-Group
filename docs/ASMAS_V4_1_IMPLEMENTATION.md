# ASMAS v4.1 — initial safe foundation

This branch implements an **offline deterministic kernel**, not live autonomous agents. It does not send emails, charge cards, enrich leads, or access production systems.

## Files
- `asmas/core.mjs`: 5 agent identities, all bidirectional pairs, message contracts, commercial state machine, idempotency.
- `asmas/runner.mjs`: single SYN-E2E-001 fixture, full marketing → seller → quotations → closing → director exercise, **simulated USD 1,000 only**.
- `tests/test_asmas_core.mjs`: automated assertions, run with `node --test tests/test_asmas_core.mjs`.

## Integration gates (NOT implemented)
1. Supabase/Postgres owned by this project, migrations, transactional outbox, lease/fencing.
2. Durable Redis consumers and DLQ, evidence of recovery after restarts.
3. Airtable tables, idempotent upserts, synchronization reconciliation.
4. OpenAI Agents SDK real runtimes, skills, tool permissions, guardrails.
5. Live Apollo/Lusha/Gmail/payment adapters with verified scopes; default outbound OFF.
6. Vercel/cloud worker deployment and staged synthetic integration tests.
7. 15 fault-injection scenarios per master specification; all must PASS before certification.

Do not merge or deploy as production-ready until above gates are reviewed. No synthetic records may be mixed with sales KPIs.

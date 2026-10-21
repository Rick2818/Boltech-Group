# Continuous Agente 1 prospecting — 20 October 2026

Rick explicitly requested continuous 24/7 prospecting with no five-lead batch. The prior ten-minute cycle only observed CRM rows and did not perform discovery. This change reuses that executor and its existing scheduler to search, deduplicate, verify published contacts, prepare drafts, and persist resumable state in the existing Supabase agent_work table.

Explee searches use the official X-API-Key endpoint and only its documented free first-results zone, with no billed pagination, dedup lists, enrichment, or paid models. Rotate US states and ICP definitions; honor provider errors/backoff. An independent public demand source continues when Explee is unavailable. Signals and missing contacts remain RESEARCH; no buyer interest is inferred. Public contact verification checks official source, name, role, quote workflow and actual MX. Drafts retain evidence/history review gates and never send from this preparation cycle.

A compare-and-swap lease prevents concurrent research cycles; stable IDs, email/company deduplication and persisted source cursors preserve progress. The runtime budget checkpoints work rather than imposing a total candidate target. Existing outbound, Gmail replies, payments and Wompi are not modified.

Validation: eight node:test scenarios cover more than five candidates, checkpoint continuation, deduplication, provider quota fallback, active leases, free-only API payload, unknown MX, evidence review state, ambiguous published contacts and private-source/redirect rejection. These are QA simulations. Production functional proof must include the deployed SHA, a real scheduler receipt, actual source response, persisted records and checkpoint readback; deployment READY alone is insufficient.


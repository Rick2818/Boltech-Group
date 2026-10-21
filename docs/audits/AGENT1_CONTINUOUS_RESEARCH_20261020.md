# Continuous Agente 1 prospecting — 20 October 2026

Rick explicitly requested continuous 24/7 prospecting with no five-lead batch. The prior ten-minute cycle only observed CRM rows and did not perform discovery. This change reuses that executor and its existing scheduler to search, deduplicate, verify published contacts, prepare drafts, and persist resumable state in the existing Supabase agent_work table.

Explee searches use the official X-API-Key endpoint and only its documented free first-results zone, with no billed pagination, dedup lists, enrichment, or paid models. Rotate US states and ICP definitions; honor provider errors/backoff. An independent public demand source continues when Explee is unavailable. Signals and missing contacts remain RESEARCH; no buyer interest is inferred. Public contact verification checks official source, name, role, quote workflow and actual MX. Drafts retain evidence/history review gates and never send from this preparation cycle.

A compare-and-swap lease prevents concurrent research cycles; stable IDs, email/company deduplication and persisted source cursors preserve progress. The runtime budget checkpoints work rather than imposing a total candidate target. Existing outbound, Gmail replies, payments and Wompi are not modified.

Validation: eight node:test scenarios cover more than five candidates, checkpoint continuation, deduplication, provider quota fallback, active leases, free-only API payload, unknown MX, evidence review state, ambiguous published contacts and private-source/redirect rejection. These are QA simulations. Production functional proof must include the deployed SHA, a real scheduler receipt, actual source response, persisted records and checkpoint readback; deployment READY alone is insufficient.


Production evidence: PR #186 merged as 33232efe3ed6cc22578a74e944d444af9cf16a87; production deployment dpl_EQWmUfRLr5rqmrwBmnpWjWEHw188 READY on the canonical alias. Actions run 39517968084, job 118975674122 returned RESEARCH_CYCLE_COMPLETED at 2026-10-21T00:57Z: 40 discovered research records (10 Explee named-company candidates and 30 unverified public signals), 10 actual MX verifications, four prepared drafts, zero outbound messages, zero errors. Explee creditsCharged=0, remainingBalance=1; persisted source cursors advanced to 1 and researchTotalLimit=null. CRM readback confirmed records and receipt. This proves one productive research cycle, not uninterrupted availability or buyer demand.

The production readback revealed false negatives for published `quoting`, plural quotes and contact inquiry forms. A follow-up normalizes those real source types, preserves published image alt names, and prepares source-specific copy (quote process versus project inquiry form). Official-source review is explicitly ASSISTED_OFFICIAL_SOURCE_REVIEW; no human review is fabricated. Nine QA scenarios now pass. Drafts still require current history/suppression checks before release.

Gmail inbound was rechecked independently through Actions run 39518320308, job 118975677746: searched=62, matched=0, replied=0. Real connection/search works; no buyer-reply, negotiation, close or payment is certified by this run.

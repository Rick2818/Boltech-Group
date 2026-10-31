# Marketing autonomous RSI and dashboard — implementation contract

Status: specification only; no runtime deployment or LinkedIn publishing is authorized by this file alone.

## Existing evidence
- Marketing cron is active at 2,17,32,47 minutes each hour; successful execution is not proof of delivery.
- Existing marketing content has remained in SALES_QUEUE_READY; historic rotation among QUOTE_REQUEST, SERVICE_ROUTING and LEAD_FOLLOWUP is insufficient.
- Keep Agent 1 Sales and Marketing separate. Marketing must work even if Agent 1 is paused.
- LinkedIn organization publishing is authorized by owner; personal profile publishing is forbidden. Require organization identity, approved permissions and publish receipt before enabling.

## Requirements
1. Replace fixed three-topic rotation with a configurable, versioned topic portfolio: use cases, demos, integrations, comparisons, vertical-specific pain points, education, technical explainers, proof-backed differentiation and opportunity support. Select based on sourced market demand and observed performance. Avoid near-duplicates using normalized text fingerprints and semantic similarity.
2. Preserve sources, claim checks, source timestamp, language, format, target segment, review status and content lineage. Never fabricate testimonials, performance, customers or integrations.
3. Maintain independent marketing scheduler and durable state; do not modify existing cron until replacement is certified.
4. Publish to LinkedIn **organization page only**, using an authenticated server-side integration with explicit organization URN allowlist, verified organization admin permissions and idempotency key. Fail closed on missing permissions. No personal LinkedIn publishing. Do not use unapproved third-party scraping. Persist request status, provider post ID, URL, timestamp and error; never mark published without provider acknowledgment.
5. Internal dashboard (ES/EN): content preview, queued/scheduled/published/failed statuses, verified post URLs, channel metrics with measurement timestamp, opportunities supported, RSI experiments, run errors and evidence receipts. Protect with authenticated staff access.
6. Marketing-to-Sales handoff must link opportunity/source ID to asset ID and acknowledgment. Never trigger email, DMs, Upwork proposals, Connects, or cold outreach.
7. RSI loop: observe, measure, diagnose, propose, test, compare, adopt/revert. Version strategy and retain immutable audit trail. Automatic adjustments restricted to content topic mix, format, timing and prioritization within limits. Never self-modify code, prompts governing safety, credentials, spending, permissions or provider connections.
8. Gates: unit tests for topic diversity, no duplicates, claim sourcing, no personal posting, idempotency, provider failure, no external publishing in dry run, tenant access, rollback; integration tests with mock LinkedIn and Supabase; CI Governance; Vercel preview; production deployment only after all critical checks.
9. LinkedIn go-live requires real institutional account linkage and one verified organization post receipt. Until then, status is BLOCKED_PROVIDER_AUTH, not success.

## Explicit non-goals
Do not touch Wompi, modify Agent 1 RSI, revive legacy RSI-01/02/03, spend credits, send cold email, publish to personal LinkedIn, or deactivate active executors.

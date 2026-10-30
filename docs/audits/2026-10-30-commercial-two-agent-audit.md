# Boltech commercial system — evidence audit (2026-10-30 14:50 CST)

Scope: exactly two commercial agents, Agent 1 Sales and Marketing. Read-only audit; no outreach, Connects, paid calls, Wompi changes, cron toggles, or production changes.

## Verified
- PR #178 merged on 2026-10-20 (merge commit c675f2c9d847c10dbe863d9cf4654fa0ff285875). PR body explicitly says synthetic QA does not certify Explee authentication, CRM/Gmail E2E, or scheduler readiness. Its head SHA a3f2515a93eb47b38a6893b5a6f0dffb1768d65f has 5 successful PR-triggered workflows, not live integration certification.
- Vercel production deployment dpl_9Xjqe2XTrNpyvpczaH9guUo2rvq1 READY, commit f820239d1835f0a4f29937a823ac60d29abcd564.
- Vercel production environment contains variable names EXPLEE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOLTECH_SCHEDULER_SECRET, GEMINI_API_KEY, GROQ_API_KEY, and Gmail OAuth fields. Presence does NOT validate the values, scopes, API permissions, or live access.
- Supabase Boltech project uxwfqhromoicrwzyylbn is ACTIVE_HEALTHY. Counts at review: 1,229 leads, 1,105 Agent 1 cycle receipts, 39 marketing content runs, 1 marketing-sales brief, 0 Explee hot leads, 0 Explee cursor rows.
- Supabase cron: boltech-research, boltech-marketing, boltech-receipts, buyer candidate discovery and buyer evidence review active; boltech-explee, boltech-inbox and boltech-evidence inactive. Do not change without certified replacements. Latest cron.job_run_details entries for research/marketing succeeded, but a successful SQL invocation is not proof of successful downstream API work.
- Latest Agent 1 receipt at 2026-10-30 20:46:03 UTC: EVIDENCE_ONLY; leads_checked=1229 (inventory count, not new leads); discovered=0; verified=0; outreachSent=0; salesClosed=0; marketingAssetsAvailable=3, marketingContentConsumed=0, marketingAppliedToDrafts=0. Same zero outputs across last eight receipts.
- Latest marketing content row at 2026-10-30 06:02 UTC has SALES_QUEUE_READY; single marketing_sales_briefs record is UNVERIFIED, last updated 2026-10-20. No demonstrated downstream use in latest Agent 1 receipts.
- Historical dispatch records: 19 SENT and 1 SEND_UNKNOWN; latest update 2026-10-26. No new sends performed during this audit.
- Vercel runtime logs within 20 minutes included Gemini HTTP 404 errors on the *prior* deployment; not proof of current deployment's Groq or Gemini success.

## Blockers / safe next gates
1. Explee key exists but live authentication unverified; Explee cron inactive and hot-leads tables empty. Require read-only credentialed Explee check with scoped project ID and evidence receipt before claiming connection. No paid requests.
2. Marketing produces assets but latest sales cycles consume zero. Trace queue-to-consumer linkage and record persisted consumption receipt, without enabling outbound.
3. Research is running on schedule but cycles show zero discovery/verification and repeated inventory count. Investigate source response, evidence gating and no-op reasons; do not mistake RESEARCH_CYCLE_COMPLETED for a commercial outcome.
4. Historical PR #178 five-lead gate/documentation conflicts with the later direction to remove a five-per-day limit. Treat as historical and verify active runtime gating before code change; do not alter live behavior speculatively.
5. PR #178 CI and current Vercel READY do not certify Explee, Gmail or end-to-end sales closure. Preserve existing executors until a verified replacement exists.

References: https://github.com/Rick2818/Boltech-Group/pull/178 ; https://github.com/Rick2818/Boltech-Group/pull/273 ; https://vercel.com/rick2818s-projects/boltech-group/9Xjqe2XTrNpyvpczaH9guUo2rvq1

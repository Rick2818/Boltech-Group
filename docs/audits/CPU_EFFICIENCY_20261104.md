# CPU efficiency — 2026-11-04

Goal: reduce future Vercel active CPU by at least 50%, without disabling customer service, payments, or marketplace research. No added budget.

Changes: API handlers load on demand; retired outbound modules are no longer imported by the router. Marketing verifies already-linked draft assets in batches of 20 and skips duplicate generation/writes only after verifying durable evidence. Missing assets follow the existing repair path; failed reads abort.

Local validation: syntax and five regression tests pass on Node 24. 100 already-linked synthetic opportunities require 8 database HTTP requests versus 303 in the previous implementation (97.36% fewer requests in that scenario). This is NOT a CPU measurement or production savings certification. Real CPU reduction requires comparable before/after Vercel metrics, traffic and deployment SHA. No real customer messages or payment operations were performed.

Vercel observability query returned HTTP 400; recent runtime-log query returned no entries. Screenshot shows team usage at 360% of a 4-hour allowance (14.4 CPU hours). Halving the same workload would still equate to 180%; to fit that allowance requires at least 72.23% reduction. Existing accumulated usage is not erased by deployment.

Pending: CI/Governance, preview deployment verification, production rollout and measured CPU reduction. Do not claim 50% savings or that suspension is prevented until confirmed.

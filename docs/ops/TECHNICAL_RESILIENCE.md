# Dependency isolation and complete evidence

The authenticated commercial aggregate reads partners, payments, both cohorts and costs independently. Unavailable sources return null and an unavailable componentStatus; healthy sources remain usable. A successful HTTP response can contain partial evidence and must not be treated as full operational readiness. The control tower retains available sources when payment data is unknown.

Partner and payment requests have bounded request timeouts. Cohort, cost and payment aggregation validate record pages and cursor progress; malformed responses, repeated cursors and bounded incomplete reads fail instead of reporting partial totals. Partner lists retain their existing record limit but now explicitly fail if more pages remain, rather than silently truncating.

Payment aggregation revalidates paid status, production environment, provider evidence, reference and parseable paid date in each record. These guards validate stored evidence; they do not replace a genuine provider payment, signed callback, settlement reconciliation or delivery acceptance.

Regression coverage: independent partner/payment failures, missing source preservation, malformed pages, cursor loops, bounded reads, and rejection of unpaid/non-production/invalid-date rows. Governance and the daily control run these checks.

Remaining acceptance evidence: genuine payment/callback/reconciliation/delivery; durable cross-agent outreach reservation enforcement; successful scheduled executions of every agent. A configuration or passing regression suite alone does not demonstrate these outcomes.

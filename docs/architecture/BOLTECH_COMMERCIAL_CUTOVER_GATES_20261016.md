# Boltech Group — Commercial Cutover Gates (2026-10-16)

## Official identity
The product, application, and customer-facing commercial engine are **Boltech Group**. The label ASMAS is an internal historical source reference only; avoid public ASMAS branding, separate services, and duplicate schedulers.

## Repository evidence
- PR #63: merged. Retired legacy schedules.
- PR #94: merged. Retired 17 legacy dispatchers.
- PR #64: proposed legacy API retirement; changed files currently only `api/intel.js`. **Do not assume four endpoints are retired.**
- PR #73: migration preparation; adds `asmas/*` modules and docs, but does not prove production execution.
- PR #111: permanent simplified architecture rule proposed; retain its governance requirements.
- Issue #112: authoritative migration checklist; keep open until cutover evidence is complete.

## Live default-branch endpoint dependencies (read by GitHub connector)
- `api/lead.js`: public web lead intake, `receiveWebLead`, commercial email and CRM integration. **Do not disable without replacement web intake.**
- `api/partners.js`: operational-auth partner API; imports RSI-02/03, daily lead executor, marketing executor, interagent coordination, provider clients. **Do not remove or return HTTP 410 wholesale.**
- `api/a2a.js`: authenticated partner referrals; verify external consumers and valid migration path before shutdown.
- `api/intel.js`: Tavily intelligence endpoint; lower-risk retirement candidate, but search callers and verify impact before merge.

## Explicit owner directive — 2026-10-16
**DO NOT DELETE, DISABLE, RETIRE, OR RETURN HTTP 410 FROM `api/partners.js`.** Preserve the endpoint and its existing commercial integrations throughout the migration. Adapt internal behavior incrementally only after regression tests and with existing clients maintained. This directive overrides any generic legacy-removal suggestion in this migration plan.

## Cutover acceptance gates
1. Verify immutable archive ref `backup/boltech-commercial-legacy-20261014` and restore drill, with current head SHA.
2. Map all frontend, API, workflow, cron, and external consumers for these four endpoints and any shared imports.
3. One central coordinator and one scheduled execution path; do not create redundant workers or subscriptions. Lead/customer state must persist.
4. Retain safe ingress and authorized contact rules: deduplication, exclusion list, Gmail reconciliation, per-contact consent/legal basis and audit receipts.
5. Demonstrate end-to-end Cliente Sintético (ingress → qualification → approved outreach simulation → reply → quote → simulated payment status); keep test traffic excluded from sales and accounting.
6. Run regression tests for Wompi routes, webhook handling, reconciliation, and existing production web ingress; do not change Wompi code or credentials.
7. Record exact passing CI job/run links, commit SHA, Vercel deployment and smoke responses, then approve cutover. READY alone is not proof.
8. Retire only replaceable legacy routes **excluding `api/partners.js`**, after the replacement is operational; use feature flag + rollback. No unverified auto-outreach to real contacts.

## Current determination
**CUTOVER BLOCKED** until above gates are evidenced. The legacy system must not be disabled prematurely, and production is not certified by this document.

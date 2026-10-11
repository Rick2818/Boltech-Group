# BLIA-01 autonomous discovery — implementation status

Code: `scripts/blia01-discovery.cjs`
Workflow: `.github/workflows/blia01-discovery.yml`
Branch: `feature/blia01-n8n-cloud`

## Behavior
- Search four public RSS queries covering US, Mexico, Colombia business automation opportunities.
- Normalize public results, reject missing/old dates, deduplicate by URL, rank by keyword evidence.
- Output at most 20 research candidates to `artifacts/blia01/candidates.json`.
- All results remain `RESEARCH_REQUIRED`; buyer, contact and buying intent are **not** verified.
- No Apollo/Gmail/Airtable/HubSpot writes, no emails, no payments. This avoids fabricating sales-ready leads.
- Scheduled Monday–Friday 15:23 UTC (09:23 El Salvador) **only after merge to default branch**.
- Manual dispatch also requires workflow present on default branch.
- Output is an Actions artifact, not automatically delivered to RSI-01.

## Acceptance / remaining work
1. Run with network access and inspect actual candidate quality and source links.
2. Confirm Actions workflow executes successfully after branch protection review/merge.
3. Implement company/decision-maker validation against authorized sources and opt-out checks.
4. Implement authenticated, idempotent RSI-01 intake and receipts (separate change).
5. Do not call this sales-ready, autonomous CRM handoff, or production-active before those checks.

## Risks
RSS may be blocked, empty or irrelevant; failure is logged and all-source failure fails the job.
News items are discovery hints rather than direct buyer requests. No scraping behind login.

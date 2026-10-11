# BLIA-01 ↔ RSI-01 — n8n Cloud provisioning and integration
Status: DESIGN ONLY — not provisioned, no credentials installed, no production workflows activated.
Date: 2026-10-11

## Provision n8n Cloud
1. Register Boltech's n8n Cloud account at https://n8n.io/ using the authorized business email. Choose a Boltech-named instance and enable MFA.
2. During free trial, n8n public REST API is unavailable; create workflows via the UI or import JSON manually. Do not assume external workflow-management access.
3. Keep the instance URL and workflow URLs (non-secret); store all webhook auth tokens in n8n Credentials and Vercel encrypted environment variables, never in GitHub.
4. Do not subscribe or charge without explicit approval.

## Two workflows
A. BLIA_TO_RSI01: Webhook POST /blia01-to-rsi01 (header authentication) → validate schema + provenance + synthetic flag → dedup event_id (Redis) → lookup lead by normalized email / company identity → upsert Airtable Leads → upsert RSI Agent Work with RSI-01 assignment → emit signed ACK and correlation_id. Do not send email.
B. RSI01_TO_BLIA: authenticated trigger from RSI-01 status/receipt (webhook or scheduled polling of authorized data) → validate allowed transition → dedup event_id → persist feedback (accepted/rejected/needs_research/replied/quote_requested/paid_verified) → POST to BLIA receiver on Vercel → log ACK. Do not loop events to originating workflow.

## Shared event envelope
{ "schema_version":"1", "event_id":"uuid", "correlation_id":"uuid", "occurred_at":"ISO8601", "producer":"BLIA-01|RSI-01", "lead_id":"string", "event_type":"LEAD_RESEARCHED|LEAD_QUALIFIED|LEAD_REJECTED|LEAD_ACCEPTED|LEAD_NEEDS_RESEARCH|RESPONSE_RECEIVED|QUOTE_REQUESTED|PAYMENT_CONFIRMED", "evidence_ref":"source URL or internal authorized record", "synthetic":false, "payload":{} }

## Qualification
Prioritize documented active purchasing intent, business pain, ICP fit, named buyer, urgency, and evidenced budget. UNKNOWN is not verified. Sales-ready requires evidence + valid contact channel + concrete need. Maintain statuses SENT and REPLIED separately. Mark QA 'CLIENTE SINTÉTICO' and isolate test data. Wompi $1 verification is NOT commercial revenue.

## Acceptance tests before production
- Authenticated roundtrip BLIA→n8n→RSI→n8n→BLIA with a labeled synthetic test in isolated environment.
- Invalid token rejected; duplicate event_id produces same ACK, no duplicate records.
- Feedback loop terminates; ambiguous writes require reconciliation rather than blind retries.
- Real authorized event recorded in Airtable and RSI receipt; no automatic email, no payment action.
- Both workflows published and production webhook URLs confirmed, with errors monitored.

## Blockers
Cloud account/instance not yet confirmed. n8n webhook credentials and Vercel BLIA receiver not yet implemented. Current RSI-01 executor is a technical audit of Airtable cohorts; it does not automatically perform autonomous lead discovery. A bidirectional interface must be implemented and tested, not inferred from existing RSI status.

## Objective
20 evidenced opportunities researched, five prioritized; count only verified replies, quote requests and provider-confirmed commercial payments. No fake buyers, invented experience or unapproved outreach.

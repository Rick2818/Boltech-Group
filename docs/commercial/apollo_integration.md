# Apollo integration operating contract

## Runtime and permissions
- Vercel Production secret: APOLLO_API_KEY, scoped to api/v1/contacts/search.
- Optional MCP global research: api/v1/mixed_people/api_search. Results are research-only and contain no contact emails.
- The existing GitHub control tower keeps its separately scoped APOLLO_API_KEY and campaign-search permission.
- PARTNER_API_TOKEN authenticates administrative CRM operations; HubSpot and Redis retain their existing server-side credentials.
- Do not regenerate the GitHub key when provisioning the independent Vercel key. Redeploy after saving new runtime secrets.

## Administrative routes
All routes use the existing CRM function (no extra Vercel Hobby function).
- GET /api/crm?action=apollo-readiness: configuration presence only, not connection proof.
- GET /api/crm?action=apollo-verify&perPage=10: bounded complete saved-contact pagination and one syntax/MX check. Authenticated response contains the sample provider contact ID for selection; no name/email.
- POST /api/crm?action=apollo-sync: JSON {"contactIds":["<actual Apollo saved-contact ID>"]}. One selected contact per request. The server reloads source data, validates MX, and submits only explicitly present fields to the persistent CRM queue.
- PENDING/RETRY_PENDING is queued, not synced. SYNCED_PROVIDER_CONFIRMED requires stored provider readback, numeric HubSpot ID and matching submitted fields.
- Existing /api/crm?action=recovery reports job state/history. Blocked jobs require root-cause correction and explicit resume, not deletion or replacement IDs.

## Controls and limits
Native HTTPS fixes the Apollo destination, verifies TLS and rejects redirects/incomplete/over-1-MiB responses. Requests have an 8-second ceiling; collection reads have a 25-second budget. Reads retry at most twice, honor Retry-After, and surface longer waits without shortening them. Paid organization enrichment requires explicit allowCreditConsumption:true and does not retry uncertain requests.

Saved contacts paginate completely or fail. Partial results, changing totals, repeated pages, conflicting identities and pagination ceilings are visible errors. Results with unusable emails are counted separately. API pagination is not a snapshot of concurrent changes in Apollo.

Email validation proves syntax and MX only; Apollo email status is preserved independently. No zero-bounce or mailbox-existence guarantee. CSV provenance denotes imported source, not a separately provider-verified export.

Legacy CSV import now submits genuine contacts through the authenticated CRM queue and atomically merges local records; these files are not an external provider receipt or distributed ledger. An interrupted file lock fails closed and needs inspection before manual cleanup. Fresh local imports start RESEARCHING, never sent. Existing genuine delivery evidence is preserved.

The legacy Apollo bulk dispatcher is retired because it lacked a durable delivery ledger and contained unsupported claims. Existing approved sales agents retain their role. The MCP no longer claims a rendered video or Airtable write from a generated URL/local JSON file.

## Acceptance
34 focused contract tests cover pagination, authentication, limits, retries, timeouts, source identity, MX uncertainty, CSV parsing, local persistence, CRM states and MCP provider calls. Governance includes this group and all existing safeguard groups.

The manual Apollo Production Acceptance workflow reads actual Apollo data without paid enrichment or sending mail. Its optional verify_crm input synchronizes one existing saved contact and confirms durable CRM completion and identical-payload deduplication. Reports exclude tokens, email addresses and personal names. Production acceptance must be recorded separately before assigning an operational score.

## Runtime provisioning — 2026-10-03 El Salvador
The user provisioned the independent sensitive Production key. Vercel rejected renaming the Sensitive variable BoltechVercelCRM. The client accepts this specific provisioned name as an alias when APOLLO_API_KEY is absent; the standard name retains precedence. Its value was not read, copied, changed or regenerated. This commit rebuilds Production with the runtime configuration; provider acceptance is recorded separately.

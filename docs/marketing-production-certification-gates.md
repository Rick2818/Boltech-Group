# Marketing B2B — production readiness certification protocol

**Scope:** Marketing agent only. This is an internal evidence-based production readiness assessment, not a NIST/OWASP/LinkedIn-issued certificate.

## Evidence contract
Every gate must record: gate_id, UTC timestamp, git_commit, environment, test_command_or_action, expected_result, observed_result, PASS/FAIL/BLOCKED, receipt_url_or_id, reviewer. Store only redacted artifacts; never store credentials or customer PII.

## Mandatory gates
| Gate | Pass criteria | Required evidence |
|---|---|---|
| MKT-01 Source verification | Allowed HTTPS sources, no redirects to private networks, DNS/IP revalidation; reject unverified claims | Security test run and source receipts |
| MKT-02 Model | Live authorized Gemini response, schema validation, rate-limit/failure recovery | Redacted provider receipt and test run |
| MKT-03 Content | Diverse topics, near-duplicate detection, source-supported claims, ES/EN | Quality results and fingerprints |
| MKT-04 Supabase | Insert, readback, idempotent rerun, RLS/auth checks, recovery | Redacted row IDs and SQL/test results |
| MKT-05 Scheduler | Existing cron executes independently, no duplicate jobs, resumes safely | Cron execution IDs and timestamps |
| MKT-06 Sales handoff | Asset/opportunity link and acknowledgment, no outreach | Durable handoff receipt |
| MKT-07 LinkedIn | Institutional organization verified, publish permission confirmed, actual post ID and public URL | Provider receipt + public link; scheduled is not published |
| MKT-08 RSI | Baseline, minimum sample, experiment version, decision and rollback | Persisted experiment IDs |
| MKT-09 Dashboard | Staff authorization, ES/EN, mobile and real metrics; unauthorized access denied | E2E and access-control test artifacts |
| MKT-10 Security | OWASP LLM threats, secrets, SSRF, prompt injection, excessive agency, no spending | Threat-model and test results |
| MKT-11 CI/Governance | Targeted tests explicitly executed on final merged commit; required checks pass | Workflow run URLs |
| MKT-12 Production | Deployment SHA matches approved commit; endpoints and live receipts verified | Deployment ID and smoke-test results |

## Release decision
CERTIFIED only if MKT-01 through MKT-12 PASS with real evidence. Mock-only tests cannot certify live provider, cron, publishing or production gates. Otherwise label FUNCTIONAL_NOT_CERTIFIED, BLOCKED or FAILED and record the precise missing receipt. A GitHub workflow named 'Governance' passing is not proof of all twelve gates.

## Standards alignment (reference, not external endorsement)
- NIST AI RMF: https://airc.nist.gov/airmf-resources/airmf/5-sec-core/
- OWASP LLM Top 10: https://genai.owasp.org/llm-top-10/
- LinkedIn Posts API permissions: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- GitHub artifact attestations: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations

## No-go conditions
No personal LinkedIn posting, no cold outreach, no Upwork Connects, no Wompi changes, no duplicated scheduler, no paid provider activation without authorization, no changes to Sales RSI. Keep existing production active until replacement is certified.

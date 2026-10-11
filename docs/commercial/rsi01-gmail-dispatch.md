# RSI-01 Gmail dispatch — operational contract (2026-10-11)

Pipeline: BLIA-01 public research → deterministic handoff → authenticated Airtable research intake → RSI-01 qualification gate → explicit release → Gmail API → Airtable receipt.

**Default: NO SEND.** The workflow's Gmail dispatch step does nothing unless GitHub Actions repository variable `RSI_GMAIL_SEND_ENABLED=true`. Never enable before a controlled owner-only acceptance test and review of live Airtable field/status compatibility.

Required GitHub Actions secrets: `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `RSI_APPROVALS_JSON`, `GMAIL_ACCESS_TOKEN`; variables: `RSI_GMAIL_SENDER`, `RSI_GMAIL_SEND_ENABLED`. Access tokens must have Gmail send scope, must belong to the sender, and **expire**: use short-lived controlled runs; automatic refresh is NOT implemented. The ChatGPT Gmail connector does NOT automatically provide credentials to GitHub Actions. No credentials are committed to the repository.

`RSI_APPROVALS_JSON` is an object keyed by the 64-character BLIA event_id. Each record requires independently documented booleans `buyer_verified`, `contact_verified`, `intent_verified`, `permission_verified`, `template_approved`, `recipient_verified`, and `release_to_send`, plus `recipient`, `approved_subject`, `approved_body`. Sender must match `RSI_GMAIL_SENDER`. Do not set these to true on the basis of RSS alone. Commercial outreach must comply with procurement channel restrictions and anti-spam laws.

Before sending, the dispatcher reserves a deterministic `Work ID = RSI01:GMAIL:<event_id>` in Airtable RSI Agent Work. Any existing reservation blocks retries. An ambiguous API response or receipt-write failure requires **manual reconciliation against Gmail Sent**; never blindly rerun. The Airtable search/create pair is not an atomic transaction across parallel workers; keep workflow concurrency serialized and do not run another independent dispatcher. This is an at-most-once *attempt* policy, not mathematically exactly-once delivery.

The current BLIA discovery produces unverified news candidates. Therefore, ordinary runs will send **zero emails**, as intended. An owner-to-owner transport test via ChatGPT Gmail is not evidence of autonomous GitHub Gmail dispatch. Production acceptance requires GitHub Actions run URL, passing tests, real authenticated Airtable intake receipt, controlled authorized dispatch, Gmail message ID, and matching Airtable receipt.

Known limits: OAuth token refresh, atomic reservation, proof of autonomous commercial delivery, live Airtable field option compatibility, and secrets availability are not certified. Keep `RSI_GMAIL_SEND_ENABLED` false until those are resolved.

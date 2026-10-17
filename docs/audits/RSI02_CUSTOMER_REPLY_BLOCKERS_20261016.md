# RSI-02 customer replies — 16 October 2026

Goal: receive a customer reply, process it through the existing RSI-02 coordinator, and observe a provider-confirmed reply in the same thread without duplicates.

## Evidence and correction

- Main inspected: `3ef41227fd4bc696f073df29674f328dfc6fc948`.
- Harness issue #86 production probe at `2026-10-17T00:29:26.739Z` read that exact revision but returned `GMAIL_OAUTH_INVALID_GRANT`. ChatGPT's connected Gmail account is a different authentication path; sending through it does not repair production OAuth.
- Synthetic thread `1a146fae2711bcf4` has inbound question `1a14701c9e01f19f`, but no subsequent RSI-02 reply was observed in Gmail at this session's inspection. Synthetic/QA CRM records are deliberately excluded by this executor; do not remove the exclusion merely to produce a passing result.
- Commercial activation read RSI-01/MARKETING queues before invoking the inbox. A queue failure prevented even an attempted customer reply. Queue reads are now confined to the read-only status branch; execution reaches the inbox first. A runtime regression executes the actual handler section with a queue failure and observes the inbox before the failure.
- Removed the interested-reply template's offer of a discussion; it now requests process/tools/outcome in writing and warns against sending credentials.
- Existing Vercel coordinator schedule: once daily at 09:00 El Salvador. This does not provide prompt or continuous customer service. No new executor, scheduler, billable model or payment modification was introduced.

## Validation and limits

Eight focused local tests passed: authenticated cron contract, single schedule, queue outage ordering, reply classification, disabled mode, same-thread receipt/deduplication and suppression. Handler syntax check passed. CI must independently run the same tests before merge.

The executor uses rules and templates, not general question answering. It only processes CRM-matched, nonexcluded senders whose threads contain prior corporate mail; connector-sent prospecting without CRM registration is insufficient. Unknown send outcomes remain held for review. Other existing limits include a seven-day inbox query and a 75-message per-run cap.

Status: **CODE_CORRECTION_TESTED_LOCALLY; PRODUCTION_REPLY_NOT_CERTIFIED**. Restore valid Google OAuth consent/refresh credentials through the account owner's normal authorization flow, verify production profile access, deploy this change, reconcile CRM records and run an isolated QA path that preserves synthetic exclusion. Only an actual received reply and duplicate check can certify the bounded reply flow. A successful build or READY deployment cannot substitute for these receipts.

## Requested AI connection

User explicitly requested conversational AI for RSI-02. Added opt-in `createRsi02AiReply` using the already declared AI SDK/Google provider, bounded thread context, structured output, 15-second timeout, no retries or paid fallback, and a shared Redis quota of 30 generation attempts per UTC day. Missing key/model, unverified free tier, unavailable provider or review-required output leave the incoming message unclaimed and eligible after recovery. Prices, contracts, payment and deadlines are held for review. This is a bounded diagnostic assistant, not an authorization to commit commercial terms. No new scheduler or agent was created.

Vercel metadata inspection found no Gemini/Google/Gateway API-key variable. No live model call or OAuth repair was possible. The owner must supply a valid free-tier project key through the secret store, verify billing is disabled, select an available model and restore Google Gmail consent. Eleven local tests passed; model responses were injected fixtures, not live provider evidence.

The earlier push was rejected by automatic approval review because publication to the destination branch was not explicitly authorized. No alternative publication route was attempted. User also requested subsequent review of RSI-03; this remains pending after RSI-02 activation.

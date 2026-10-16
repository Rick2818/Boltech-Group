# RSI-02 / RSI-03 — Production harness, 16 Oct 2026

## Implemented code and receipts
- PR #104 merged: `c0aab12ffc20df3c26b72ec28c11b4d718daf1f3`; PR #106 merged: `01e7ed5530b9aaaeb15cfd904857b7ac2bd7b68f`.
- Vercel Hobby reuses existing single cloud cron: `GET /api/partners?action=commercial-activation&run=1`, 15:00 UTC (09:00 El Salvador), secured with CRON_SECRET. No added paid serverless function.
- RSI-02 reads Gmail replies and verifies company CRM address, outgoing thread, exclusions, opt-outs and automatic mail; uses Redis NX permanent idempotency and Gmail messageId/threadId receipt. If disabled, inbox messages are not consumed.
- RSI-02 runs independently before Marketing in cron, so Marketing failures do not block replies.
- RSI-03 existing closing executor runs only on individually director-approved signed scopes; payment and acceptance require separate real evidence, with no synthetic sale inferred.
- Vercel Production flag `RSI02_AUTOREPLY_ENABLED=true` added after PR #106 merged. A **new READY production deployment created after that flag** is mandatory.

## Certified in GitHub CI
- RSI-02/03 Inbox Certification: PASS (synthetic in-thread send; no-duplicate, opt-out; cloud closing orchestration).
- Followup Safety: PASS.
- Production health / pull_request: PASS.
- Boltech Governance Validation: PASS.
- ASMAS RSI-01 09:00 SV watchdog: PASS.

## Not yet certified end-to-end
- Controlled real inbound Gmail reply → authenticated Vercel cloud execution → outbound Gmail receipt → Airtable → approved RSI-03 case has NOT been observed. Code QA PASS cannot substitute for a provider receipt.
- Cron is **daily**, not hourly/instantaneous, on existing Hobby setup.
- Live closing requires a buyer's qualified opportunity, technical scope, director approval, actual acceptance and Wompi-confirmed payment. No genuine sale has been verified.

## Next acceptance gate
1. Production deployment after flag is READY on exact commit.
2. Controlled synthetic inbound from a distinct sender to a previously sent corporate Gmail thread; make it eligible only for QA, honor exclusion rules.
3. Invoke actual secured cron and verify original Gmail thread, one send only and CRM message IDs.
4. Validate handoff to RSI-03 signed case, refusal handling and recovery logs, then update GitHub issue #103 and mark FULL PASS only if receipts exist.

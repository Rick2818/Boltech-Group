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


## Harness update — 2026-10-16 controlled synthetic test and blocker isolation
- Production Vercel READY `ee720ae566a0d6dd930ce7d03351192bbcc80a91` after `RSI02_AUTOREPLY_ENABLED=true`; later production commit `62504e61ac0ea725c062fd9d2b192378bdf4ddb2` also READY (daily marketing executor PR #108).
- Synthetic CRM customer labelled **CLIENTE SINTÉTICO RSI02-QA-20261016 — NO VENTA**, Airtable `recksRjZ4YA9wK5UM`, sender personal controlado `rick28191@gmail.com`. Not a real lead or revenue.
- Corporate Gmail sent controlled first message `1a146fae2711bcf4`, thread `1a146fae2711bcf4`. Synthetic response from personal account recorded in corporate Inbox as `1a14701c9e01f19f`, in the same Gmail thread.
- Corporate Gmail search of QA subject at time of this audit found just original corporate SENT + synthetic inbound; **no outbound RSI-02 autoreply receipt yet**. Thus cloud Gmail inbox processing remains **PENDING PROVIDER CERTIFICATION**; never mark FULL PASS.
- Vercel runtime logs on Hobby return no matching logs for recent deployment / historical 2h query exceeds Hobby retention; absence of accessible logs is NOT proof of successful run.
- Remaining dependency found: `api/partners.js` read RSI-01/MARKETING queue before invoking RSI-02. New PR #110 `fix/rsi02-first-in-cron-20261016` moves Gmail inbox execution **ahead of** those queue reads, under the same CRON_SECRET and existing 09:00 SV cron. On head `75b8df731d14fb859c9c9945fef9e8b26d150907`, RSI-02/03 synthetic certification, Followup Safety and Production health have reported PASS; Governance and ASMAS may still be in progress at the time of writing. DO NOT claim this PR merged or deployed until verified.
- Existing daily Vercel Hobby cron is 15:00 UTC (=09:00 El Salvador); not on-demand or hourly. A task must actually invoke cloud flow and supply Gmail/Airtable/Redis receipts for final certification.
- RSI-03 has implemented signed Director approval gate; no qualified signed synthetic closing artifact and no real payment receipt has been verified yet. No automatic quote/charge should bypass approval.

**Next evidence:** merge PR #110 only after all required checks PASS; inspect Vercel exact SHA READY; execute an authenticated production cron under operator control or wait for the scheduled run; confirm exactly one automated Gmail reply to QA thread plus CRM receipt; then exercise separately a signed QA closing case for RSI-03. Close #103 only with provider-side evidence.

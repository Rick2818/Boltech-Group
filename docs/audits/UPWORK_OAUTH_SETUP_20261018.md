# Upwork OAuth setup — 18 October 2026

Objective: supply a real callback URL for Ricardo's API application, then connect approved OAuth credentials to the existing RSI-01. The account was verified with 0 API keys before the application. The form is prepared for a private read-only web application. Ricardo explicitly confirmed acceptance of the Upwork API Terms and application submission on 18 October 2026 at 15:16 SV. A browser submission attempt is in progress; no submission receipt has been confirmed. Do not request the same approval again or retry submission without reconciliation.

Minimum flow: Ricardo requests a key → Upwork reviews it → authenticated operator starts OAuth in Boltech → one-use browser-bound state → provider token exchange → encrypted Redis storage. Owner: RSI-01; secrets stay server-side. No new agent, scheduler, paid service, proposals, payments or external lead export.

Reuse api/index through an exact Vercel rewrite and the existing operational bearer authentication and Redis. Missing credentials/store must stop authorization. Callback origin and provider endpoints are fixed, not request-controlled. State expires after ten minutes, is atomically consumed and bound to an HttpOnly secure cookie. Tokens are encrypted with a context-derived key from the Upwork client secret; rotating that secret requires reauthorization.

Acceptance: route is live, absent/invalid state cannot call provider, replay fails, unauthorized start fails, provider/store errors expose no secrets, mock token exchange stores only ciphertext. Actual OAuth and discovery remain pending approved keys and live provider validation. Rollback: revert this isolated change; no changes to Wompi or existing senders.

Sources: https://www.upwork.com/developer/documentation/graphql/api/docs/index.html#getting-started-authentication and https://upwork.github.io/python-upwork-oauth2/client.html .

## Verified implementation and production evidence

- PR [#164](https://github.com/Rick2818/Boltech-Group/pull/164), merged main `014e961fc7ce65ebe2d9ff755b127d8c25fea601`.
- Production deployment `dpl_7gNRQGsr2nm57yvpQyWUnQZn2KHi`: READY, exact main SHA and production alias verified.
- At 21:14 UTC (15:14 SV), `GET https://boltech-group.vercel.app/api/upwork/callback` returned HTTP 200 with `UPWORK_CALLBACK_READY`, `credentialsConfigured:false`, `agent1Connected:false`.
- Existing partner health also returned HTTP 200 AVAILABLE.
- All 13 isolated OAuth safety tests passed locally and in governance CI [39166669264](https://github.com/Rick2818/Boltech-Group/actions/runs/39166669264). Followup Safety, Inbox Certification and production health checks on PR #164 also passed.
- Upwork form: Web project; API Usage 1–10; rotation 12 months; Common Entities read-only, Job Details read-only, Read marketplace Job Postings, Read public marketplace Job Postings. No write, messaging, proposal or payment permissions selected.

## Current access and next action

| Source | Confirmed state | Next action |
| --- | --- | --- |
| Upwork | Callback and OAuth receiver deployed; API application authorized; submission receipt not yet confirmed | Reconcile the pending browser result once, record the actual application status, then obtain provider approval and complete server-side credentials plus read-only discovery integration |
| n8n Community | Existing account login rejected the prefilled credentials; no authenticated access or agent connector verified | Ricardo signs in to the community account in the open browser; distinguish the jobs community from a separate n8n automation instance |

The current Upwork OAuth receiver is not a discovery adapter or a working agent 1 connection. The earlier provider preflight and discovery still report the pending integration. Do not call these platforms connected based on the callback, a browser session, the application form or synthetic tests. Secrets, codes, refresh tokens and passwords must never enter Git, README, audit documents or screenshots.

The standing commercial follow-up rule and four assisted Gmail sends are recorded by PR [#163](https://github.com/Rick2818/Boltech-Group/pull/163) and [the commercial audit](COMMERCIAL_TRACTION_SYNTHETIC_20261018.md). Those sent receipts do not prove buyer interest or independent production execution.

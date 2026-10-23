# Boltech Commercial Verification V2.1 — delivery contract
Status: IMPLEMENTATION IN PROGRESS; NOT CERTIFIED. Baseline main ce622cbfab7f81701ceea6d72d456ad2f4322f0a (2026-10-23).
Owner: Agent 1, with Marketing providing opportunity-specific content. Exactly two agents. No changes to Wompi; no paid services.

## Objective and invariant
Replace fragmented recipient approval and email dispatch with ONE durable verification/dispatch engine. Never infer permission from published email, green CI, absent DNC hit, absence of Gmail matches, or model judgement. Source evidence, consent/legal eligibility where applicable, sender policy and explicit operator-defined authorization must be satisfied. An unresolved check is REVIEW_REQUIRED, never CLEAR.

## Baseline defects
- Official shared-mailbox review ends SUPABASE_DISPATCH_NOT_CONFIGURED.
- Named-buyer draft and company draft have separate review branches and conditional eligibility.
- Suppression relies on local registry, Redis and Supabase lead snapshots; unavailable reads cannot assert CLEAR.
- Gmail history and provider acknowledgement are not evidence of authorization; uncertain POST result cannot be retried blindly.
- PRs #190, #223, #234, #239, #242 document partial mitigations, not end-to-end production certification.

## Single canonical state machine
DISCOVERED -> VERIFIED -> ELIGIBILITY_PENDING -> AUTHORIZED -> RESERVED -> SENDING -> SENT -> RECONCILED -> FOLLOWUP_DUE.
Terminal/hold states: REJECTED, SUPPRESSED, REVIEW_REQUIRED, SEND_UNKNOWN, FAILED_RECONCILIATION.
Each transition uses one Supabase transaction/RPC or unique-index guarded CAS. No multiple active executors. Partition by normalized sender + recipient + campaignId + purpose. Authorization does not equal SENT.

## Receipt contract
Per candidate: evidence URLs and checkedAt; personal name/role/email or explicitly typed company mailbox; target-fit/workflow; Marketing asset ID and content hash; DNC sources statuses & timestamps; CRM and Gmail lookup outcomes; authorization identity/reason/policy version; lease ID/expiry; stable RFC Message-ID; Gmail provider messageId/threadId when found; recovery attempt/last error; nextAction. No secrets or private message bodies in logs.
When evidence is incomplete keep REVIEW_REQUIRED with precise reason and bounded retryAt, never an indefinite silent queue.

## Implementation gates (one branch, one integration)
1. Inventory and snapshot production entrypoints, cron, Supabase tables, secrets (names only), switches, archives, dependencies. Test current baseline. Freeze all unrelated work.
2. Implement unified pure verifier with typed evidence and explicit REVIEW_REQUIRED/BLOCKED/CLEAR outcomes. Full test matrix for no source, stale/future evidence, duplicate company/person, DNC unavailability/hit, Gmail 401/403/429/5xx, Marketing mismatch, and policy authorization.
3. Implement durable Supabase-backed outbox and one executor; reserve atomically before send. Persist intent and stable message identifier; on POST timeout/unknown do NOT send again, reconcile by exact message ID + recipient via provider before any retry; unresolved -> SEND_UNKNOWN for human review.
4. Wire Agent 1 + Marketing to canonical work receipts. No legacy dispatch path can run concurrently. Feature flag defaults disabled for sends, allows shadow-verification only.
5. CI runs all targeted and integration tests, fail-closed scenarios, fault-injection and concurrency. Review schema migrations, security and no-Wompi regression.
6. Canary EDM Express ONLY after verified eligibility & authorized outreach. Capture actual provider ID, thread ID, CRM state, exact material consumed. Run fail/recovery test without a second send. Verify scheduled cloud execution without desktop.
7. Deploy with feature flag, confirm version/health and scheduler. Expand only after evidence meets acceptance.
8. Archive legacy module/workflows with dated manifest AFTER production certification and ensure zero old senders remain. Keep git history and audit evidence; rollback plan must stop all sends first.

## Non-negotiable acceptance (objective)
- 100% mandatory tests passing on exact deployed SHA; production health check for same SHA.
- 0 unauthorized or duplicate sends; suppressions fail closed.
- At least one permitted real production send from canonical executor, matching Gmail messageId/threadId and CRM receipt (not a synthetic send).
- A deliberately ambiguous delivery response reconciles without retrying an actual POST and retains a durable receipt.
- Scheduler executes in cloud; no laptop required. Only one active sender route.
- Legacy sender jobs disabled/archived after proof. Wompi unchanged.

## Stop conditions and rollback
Until all gates are met, status remains NOT CERTIFIED. Provider credentials missing, DNC unavailable, legal authorization absent, or ambiguous send must block sends, never bypass checks. Revert feature flag and pause scheduler if any duplicate, unauthorized mail, integrity mismatch or unknown sender occurs. Never delete historical lead/provider evidence.

## Handoff after session interruption
Read this file first, inspect branch/PR and deployed commit, execute the first incomplete gate, attach links to actual test runs, release, provider receipts and migration evidence. Never claim completion based solely on code or green CI. Keep outstanding blockers explicit.
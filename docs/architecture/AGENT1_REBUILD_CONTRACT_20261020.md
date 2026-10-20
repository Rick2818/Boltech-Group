# Boltech Agent 1 — Replacement contract (2026-10-20)

## Isolation
The Marketing Agent (all `lib/marketing_*`, `docs/marketing/`, marketing schedules and marketing integrations) is immutable for this rebuild. Wompi and its configuration are immutable. Retain the CRM, leads, email history, suppressions, drafts, receipts, offer terms, and recovery ledgers. Never remove shared libraries without dependency proof.

## Mission
A single autonomous sales agent owns account research, verified prospect qualification, personalized outreach, reply handling, follow-up, proposals, and human-approved closing/payment handoff. Marketing passes targeting signals; there is no new marketing agent.

## Sales playbooks (implement locally, no paid dependencies)
1. Salesforce Trailhead: prospect research and qualifying need, budget, authority, timing.
2. Apollo-style: search sources, enrich verified contacts, sequences and sender validation.
3. Outreach-style: distinct touchpoints, reply-aware follow-up, suppression controls.
4. HubSpot-style: CRM pipeline, stage progression and next-action tracking.
5. SPIN consultative discovery: Situation, Problem, Implication, Need-payoff. Never fabricate needs or prior conversations.

The sources are methodological references, not vendor SDK licenses or proof of a working connector.

## Commercial constraints
Five unique verified US B2B prospects per business day at 09:00 America/El_Salvador; only genuine verified company addresses. Price USD 990, maximum 10% discount, 50% upfront and 50% on completion; never split monthly subscriptions. Send no duplicates; never send to suppressed/bounced/unsubscribed contacts. Before each dispatch reconcile Gmail history and replies.

## Execution contract
Exactly one orchestration entrypoint with a persistent idempotency key per recipient+campaign, explicit states DISCOVERED, VERIFIED, READY, RESERVED, SENT, REPLIED, QUALIFIED, PROPOSED, WON, LOST, BLOCKED, UNKNOWN. At most five new outbound messages per calendar day. UNKNOWN is held for reconciliation, never blindly retried. A failed Telegram health check must not gate Gmail dispatch. Durable auditable receipts must include candidate source, evidence, eligibility, send provider id, and CRM event ids, without publicly committing customer PII.

## Retirement gate
Do not delete old Agent 1 executors, workflows, or `.agents/skills/agent1-*` until a new executable path passes: lint/tests; a synthetic complete funnel without sends; one real controlled Gmail send with message-id, reconciliation and reply handling; a 09:00 scheduler run with persisted receipt and 5-lead cap; a safe rollback test. Then remove only Agent-1-exclusive artifacts using a dependency map. No replacement scripts should depend on legacy marketing internals.

## Baseline evidence
Existing Agent 1 audit documents 91 passing local tests yet explicitly states production dispatch and full autonomous funnel are unverified. The daily health monitor failure caused by Telegram must not be mistaken for proof of a commercial send.

# Alternate Agent 1 production trial

User authorized a production trial with error observation. Mode AGENT1_EXECUTOR_MODE=ALTERNATE_V2 selects the alternate Agent 1 dispatch engine within the existing scheduled inbox worker. CANONICAL_V2 or removing the mode restores canonical dispatch on next deployment. No additional sender, Redis ledger, cron or agent is activated.

Reuse the canonical verified receipt, fresh policy/history/suppression recheck, atomic Supabase outbox, Gmail transport, receipt reconciliation and follow-up worker. Unknown outcomes remain held and lookup-only. Existing provider/outbox safety constraints remain in effect. Postal policy remains mandatory and has not been bypassed. No address is inferred from an email address.

Predeployment validation: 102 tests pass including alternate success, ambiguous send followed by reconciliation without duplicate POST, blocked suppression, inbox reply pricing, original V2 verifier/dispatch and alternate engine tests. These use injected test doubles and do not demonstrate live customer sends.

The price response no longer quotes an unapproved historical amount. Fixed recheck projection to include country/data quality required by policy. Wompi unchanged.

Operational acceptance: observe persisted inbox receipt with campaign.engine ALTERNATE_V2. Check reviewed/eligible/held/errors and genuine Gmail/Supabase receipts. Zero sends with retained recipients is not a recovered sales funnel. No automatic replay after unknown send. Rollback retains the same outbox so reservations survive mode switches.

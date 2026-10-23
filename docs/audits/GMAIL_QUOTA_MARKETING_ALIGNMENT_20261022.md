# Gmail quota recovery and verified Marketing selection

22 October 2026. Responsible: Agent 1 application maintainer.

Production scheduler receipts identified HTTP 403 `rateLimitExceeded` during
`MESSAGE_READ`. The inbox scanned unrelated mail every cycle, and only 429/5xx
were retried. Reads now search canonical contact senders in bounded query pages.
Transient quota reads retry once after a delay; repeated failures persist an
exponential cooldown in the existing `agent_work` table (one minute to one hour).
Followup and initial-outreach scans stop immediately on read quota exhaustion and
release their leases. Sends remain non-retried; uncertain sends still require
provider reconciliation. No new scheduler, agent, paid service or schema.

Marketing was selected before official workflow verification. Research now selects
the queued asset after `publishedWorkflow` is known and prepares the final draft
from that matching asset. Initial outreach can recover old mismatched assignments
by selecting the newest ready asset for the freshly verified workflow. Missing
material or evidence remains held. The durable send receipt records the asset
actually used; provider identity, suppression and history controls remain required.

Acceptance tests cover 403 recovery versus permission failure, persistent cooldown
and recovery, lease release on quota failure, unknown-workflow intake, replacement
of a stale mismatched asset, final body/receipt correspondence and uncertain-send
deduplication. Local targeted suite: 58 passing tests. Live acceptance additionally
requires a scheduled inbox cycle after deployment, and an eligible campaign send
with Gmail receipt and matching Marketing ID during the authorized sending window.
Tests and deployment readiness alone do not certify that live send.

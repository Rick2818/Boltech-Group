# Email-only commercial improvement cycle

The existing daily control reads campaign outcomes and selects one next action. Missing values remain unknown; untracked opens never imply no interest.

| Stage | Action | Evidence |
|---|---|---|
| Measurement | Read authorized campaign counters | Timestamped provider report |
| Reply | Diagnose needs and requirements by email | Genuine response |
| Delivery failure | Review addresses before further sends | Bounce record |
| Early silence | Preserve existing follow-up timing | Scheduled step |
| Qualified need | Prepare bounded proposal | Agreed scope |
| Acceptance | Verify payment channel before starting | Written acceptance and genuine payment evidence |
| Learning | Change one variable in a comparable next cohort | Hypothesis and measured result |

All coordination is by email. The control is read-only and does not send messages, change campaigns, consume prospecting credits or confirm revenue. Missing API access is reported explicitly. The existing daily workflow runs the decision tests before measurement.

Validation: `node --test tests/test_traction_cycle.mjs`.

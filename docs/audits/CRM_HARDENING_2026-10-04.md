# CRM hardening verification — 2026-10-04 UTC

Provider code commit: aae26bc748529dd1ebbdd192407ea1e64fb6bba8.

## Safeguards
- Verify the requested email and numeric contact ID before any PATCH; mismatched identity blocks the write.
- Restrict native HTTPS transport to api.hubapi.com contact endpoints and GET/POST/PATCH. Reject incomplete responses; retain 8-second request timeout and 1 MiB response limit.
- Honor numeric and HTTP-date Retry-After values (bounded to 24 hours), with 60-second fallback.
- Reject malformed contact input and control characters in optional contact fields.
- Retain persistent queue, per-email leases, duplicate-payload IDs, provider read-after-write, explicit recovery and sanitized history.

## Evidence
- 30 focused local tests passed (provider regressions plus recovery subset). This is not a claim that the complete repository test suite ran locally.
- GitHub provider regression workflow passed: https://github.com/Rick2818/Boltech-Group/actions/runs/37173309053
- Production controlled test passed: https://github.com/Rick2818/Boltech-Group/actions/runs/37173343192
- Fresh job be83f2cc284ab635932985a07737f7f70ebfb797ce5d6945ef61bc787b0d5a16 entered PENDING then COMPLETED in one attempt.
- Existing contact ID 252891994553 was updated with company marker "Boltech CRM - PRUEBA TECNICA"; provider readback confirmed supplied fields.
- Two identical follow-up submissions returned the same job and contact. This verifies cached duplicate-payload handling, not fresh writes on each repetition.
- Controlled production workflow restored to manual-only after this run; regression tests use simulated provider responses and no production credentials.

## Operational handling
Authentication/identity failures stop delivery. Check sanitized job code/history, correct credentials or provider data, then explicitly resume through the authenticated recovery endpoint. Do not delete jobs or repeatedly enqueue different payloads to bypass a blocked failure. Rate-limited jobs retain their retry deadline. Tokens remain in existing server-side secrets.

These controls cover the CRM integration tested here; they do not establish absolute security or verify payment/refund flows.

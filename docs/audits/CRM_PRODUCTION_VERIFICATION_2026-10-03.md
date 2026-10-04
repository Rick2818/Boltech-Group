# HubSpot CRM production verification — 3 October 2026

Responsible: ChatGPT / Codex. Requested by Ricardo Ernesto Bolaños Hernández.
Verified at 21:04 El Salvador (2026-10-04 03:04 UTC).

## Result

PASS: the controlled contact recovery completed with provider-confirmed contact ID.
GitHub run: https://github.com/Rick2818/Boltech-Group/actions/runs/37172779443
Artifact: https://github.com/Rick2818/Boltech-Group/actions/runs/37172779443/artifacts/11292256214

Test contact: PRUEBA TÉCNICA Boltech CRM, boltech-crm-test@example.com.
HubSpot ID: 252891994553; account 52089821.
Exact-email search through the independent HubSpot connector returned total=1.
Job ID: 2478a2a993b35d0c173b764ef591491d90490e612d39a0b43d7fcdb14530dc2f.
Recorded state: COMPLETED.
Repeated identical submissions returned the same job ID and contact ID.

## Diagnosis and correction

The original service key lacked contact read/write scopes. The user corrected both scopes.
After that change, the contact existed, but production GET responses delivered through runtime fetch returned HTTP 200 with no usable JSON and no Content-Type header. Sanitized runtime diagnostics confirmed INVALID_JSON. Adding readback and a batch fallback alone did not close the live test.

HubSpot transport now uses bounded Node HTTPS with TLS verification, identity encoding, an 8-second request signal and a 1 MiB response limit. The response is fully read before JSON processing. Contact lookup, duplicate-safe conflict handling and explicit readback verify the ID and every supplied property. Batch read is available only as a fallback for an invalid successful GET, and it must return exactly one matching active contact. Success requires provider evidence.

Administrative resume may explicitly expedite only INVALID_RESPONSE or BATCH_READ_UNCONFIRMED retries after correction, or blocked jobs. Rate-limit and other pending retries retain backoff. The contact lease is 90 seconds, covering the bounded fallback request sequence.

Production source commit: 63410ba9f350e9c46d8d03e4d3b21652a0555a77.
READY deployment: dpl_DsigbHoLewCTmnJY1HTJ7cJPsgQP.

## Validation and limits

26 focused local tests passed: contact writes/readback, missing or archived responses, mismatched fields/IDs, malformed GET and batch fallback, authentication, recovery, lost responses, leases, duplicate-safe enqueue and explicit resume without bypassing rate limits. Existing GitHub governance/health checks passed for PR #34; subsequent production builds completed READY.

This proves the tested production contact flow and identical-payload idempotency. It does not prove marketing workflows, deals, all CRM objects, or Wompi payments. No notification/email dispatch or deal was initiated by the controlled test. The connector's separate write reauthorization status does not govern the application's service key.

Controlled test source remains available in PR #33 with manual execution; no recurring test-contact schedule is enabled.

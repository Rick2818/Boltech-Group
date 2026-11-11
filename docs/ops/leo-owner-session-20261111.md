# Leo owner browser session

The owner previously had to paste `LEO_PLATFORM_TOKEN` after every reload. The
private integration panel now creates a 30-day browser session using the existing
owner key, with an explicit sign-out button. No new provider credential is needed.

`POST /api/leo-owner-session` checks the existing Bearer owner key and sets a
random 256-bit `__Host-leo_owner` cookie: Secure, HttpOnly, SameSite=Strict,
Path=/, no Domain. Only a hash of the cookie ID is used in the existing COMMERCE
KV namespace. Session records contain issuance/expiry, exact origin, and an owner
key fingerprint. They contain neither the owner key nor provider tokens. The key
input is cleared after login; there is no localStorage/sessionStorage credential.

`GET` restores the session after reload or browser restart. `DELETE` writes a
revocation record and clears the cookie. Private integration requests and Upwork
OAuth start accept the session only with an exact same-origin Origin header.
Missing/failed storage, malformed cookies, expiry, and key changes fail closed.
The compatibility gateway removes the owner cookie before forwarding unrelated
requests to the immutable backend. Existing customer cookies and signed payment
bytes are preserved.

KV is eventually consistent. Browser logout clears the local cookie immediately;
revocation of a copied cookie can take roughly the KV cache interval (30 seconds,
or longer during propagation) across locations. This is not a promise of globally
instant revocation. A changed owner key invalidates sessions on validation, but
also affects existing Upwork token encryption; this change does not rotate it.

The source gateway/HTML are synchronized from the already deployed
`Leo_Cloudflare_Upwork_Directo.zip` (SHA256
`a713901a42429a6de2a689f9b75dd035501a20c2f55e7cc64f142af69841e2f7`).
Before editing, the live HTML matched that archive exactly. This preserves the
three providers and gentle voice/welcome that were deployed outside main.
The new module is inlined by the stdlib builder, producing exactly `_worker.js`,
`sales-agent.html`, and `_routes.json` for the original corporate Pages project.
It does not change the personal-account Worker or resurrect old sales agents.

Validation: `node --test tests/test_leo_owner_session.mjs
tests/test_pages_leo_audio_bridge.mjs` (12 passing). Bundle and browser script
syntax checks pass. Tests use isolated synthetic storage/credentials, with no
external requests or provider actions; they are not production connection proof.
Chromium UI testing in the executor was blocked by its socket sandbox; verify
the new login UI and reload persistence after production deployment using the
owner's browser. Initial real login remains an owner action.

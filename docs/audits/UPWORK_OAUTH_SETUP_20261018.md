# Upwork OAuth setup — 18 October 2026

Objective: supply a real callback URL for Ricardo's API application, then connect approved OAuth credentials to the existing RSI-01. The account currently has no API keys. The form is prepared for a private read-only web application; Terms and submission remain pending.

Minimum flow: Ricardo requests a key → Upwork reviews it → authenticated operator starts OAuth in Boltech → one-use browser-bound state → provider token exchange → encrypted Redis storage. Owner: RSI-01; secrets stay server-side. No new agent, scheduler, paid service, proposals, payments or external lead export.

Reuse api/index through an exact Vercel rewrite and the existing operational bearer authentication and Redis. Missing credentials/store must stop authorization. Callback origin and provider endpoints are fixed, not request-controlled. State expires after ten minutes, is atomically consumed and bound to an HttpOnly secure cookie. Tokens are encrypted with a context-derived key from the Upwork client secret; rotating that secret requires reauthorization.

Acceptance: route is live, absent/invalid state cannot call provider, replay fails, unauthorized start fails, provider/store errors expose no secrets, mock token exchange stores only ciphertext. Actual OAuth and discovery remain pending approved keys and live provider validation. Rollback: revert this isolated change; no changes to Wompi or existing senders.

Sources: https://www.upwork.com/developer/documentation/graphql/api/docs/index.html#getting-started-authentication and https://upwork.github.io/python-upwork-oauth2/client.html .

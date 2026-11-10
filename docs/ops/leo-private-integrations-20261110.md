# Leo private Freelancer and Explee integration

Status: prepared, not yet deployed or live-provider verified.

The original Pages API proxy pins the private legacy backend, so saving a new
Pages secret cannot make that immutable deployment consume it. This patch handles
`POST /api/leo-integrations` in the current Pages runtime. Other APIs retain their
backend, including payment requests. Existing voice and greeting are preserved.

Required production configuration:

- `FREELANCER_OAUTH_TOKEN`: user's Freelancer personal access token (secret).
- `FREELANCER_API_ENABLED`: text `true`; an existing `false` is respected.
- `EXPLEE_API_KEY`: existing Explee secret; presence is not authentication proof.
- `LEO_PLATFORM_TOKEN`: existing owner access secret, minimum 24 characters.
  Owner enters it only in the private integrations field, never chat. If the
  owner no longer has the value, replace it in runtime with a new private value;
  the model need not see it. No browser persistence or public access is enabled.
- `COMMERCE`: existing KV, used for owner-initiated read receipts (30 days).

Build with `python scripts/build_pages_leo_audio.py`. The resulting ZIP inlines
`leo-integrations.mjs` into `_worker.js`; it does not publish the module separately.
The three-entry Direct Upload artifact is deployed to `boltech-group` in account
`f8c7c411bffaade3f6f0af4384db42e0`, original boltech-group.pages.dev.

In Leo open Private integrations and enter the owner access token. Check connections
performs a real Freelancer self lookup and Explee's documented no-credit-charge
NL-to-filters request. It reports missing secrets, disabled flag and provider HTTP
failures distinctly. Status without checking only reports configuration, not success.

Owner commands `/freelancer QUERY` and `/explee QUERY` run bounded read-only searches.
Freelancer returns up to ten public projects; no bids or messages. Explee is fixed to
first page, ten companies, no criteria, contact enrichment, exclusions or pagination.
Its official schema documents these results as free, requiring positive balance;
402/429 fail without retries, top-ups or paid fallback. No campaigns or crons start.
Source: https://api.explee.com/public/api/openapi.json

24 local tests passed, including auth failures, redirect credential safety, free
request shape, private contact omission, receipts, read failures, and existing
voice/microphone/payment forwarding. Bundle syntax also passed. These are synthetic
checks; they do not establish current secret values or successful live authentication.

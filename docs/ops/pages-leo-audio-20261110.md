# Leo audio on the original Pages address

The Git-managed Worker already serves the corrected Leo frontend. The original
Pages release e912df66 still hides microphone controls and lacks the bounded
recognition restart and voice identity validation. Its private Functions source
is not in this checkout, so replacing its API with the repository's old runtime
would discard deployed handlers and runtime bindings.

`cloudflare/pages-leo-audio-worker.mjs` serves the corrected `sales-agent.html`
asset at the original `/sales-agent` address. Every other request, including
chat, speech, payments, signed callbacks, existing pages and static assets,
continues to the immutable `e912df66.boltech-group.pages.dev` deployment. Raw
request bodies, auth, cookies, response status and audio headers are preserved.
Redirects are manual and no fallback to Vercel exists.

Build the three-file Direct Upload ZIP with
`python3 scripts/build_pages_leo_audio.py`. Cloudflare supports `_worker.js`
uploads through its dashboard, unlike compilation of a `functions` folder.
First deploy to preview and check the visible microphone, chat, speech identity
and a read-only payments status request; then publish the identical ZIP to
production. Rollback is the previous Pages deployment in the dashboard.

Operational constraint: **retain deployment e912df66** while this compatibility
layer is in use. This is a frontend repair, not recovery of the separately
missing objective/autonomy handlers. Future backend changes must either update
this explicit pin after verification or bring the deployed Functions source
and its bindings under the repository's deployment process. Future frontend
changes require rebuilding and deploying this ZIP as well as the Git Worker.

## Female Salvadoran voice patch (pending publication)

The user clarified the desired voice is female Salvadoran. The previous backend returns
Rodrigo even when Lorena is supplied in JSON or query. The advanced-mode gateway now
handles only POST `/api?leo_speech=1` using the existing runtime Azure Speech key/region
and fixes SSML to `es-SV-LorenaNeural`; the frontend verifies that same ID. Other APIs
continue to use the immutable backend, including payments. No subscription is created.
The synthesis uses the existing resource and remains subject to its billing/quota; a
free tier has not been verified. Requests are limited to 800 characters, XML escaped,
same-origin checked when an Origin is supplied, and timed out at 12 seconds. There is
no browser robotic/male fallback. This patch does not certify monthly usage controls.

16 local tests passed. Live Lorena output and the user's listening check remain
pending a new Pages deployment. Do not claim this voice is restored before those checks.

Live publication confirmed the Lorena HTML hash but speech returned 502. Root cause:
Workers rejects redirect:error before network I/O. Use redirect:manual and reject non-2xx
provider responses, preserving the no-credential-forwarding policy. Corrected ZIP v2
still requires live publication verification. Updated the language regression to Lorena.

## Gentle welcome patch (awaiting listening validation)

The user finds Lorena's neutral delivery too stern. This patch retains her Salvadoran
voice identity and uses supported SSML prosody: rate -8%, volume -10%, and 180ms pauses
after sentence punctuation. It does not pretend Lorena supports an emotional style.
The audio response includes X-Boltech-Voice-Profile: lorena-gentle-v1. Subjective warmth
requires the user's listening check; valid MP3 and a voice ID cannot prove preference.

The previous private API answered a live Hola with a forced choice between email/WhatsApp
orders, invoice review and inventory. Only first greeting-only turns now receive a
neutral welcome, without qualification, actions or a forced checklist. Real requests
and ongoing conversations keep the original backend. The page and voice-test use the
same welcome in ES/EN. No payment or subscription settings are modified.

Publication check: the new welcome works, but synthesis returned provider failure.
Azure SSML prosody volume uses a number/percentage or named value; use -10%, not
-2dB. Added the standard synthesis namespace and safe numeric provider HTTP error
reporting (never provider response text or credentials). Corrected artifact awaits
new deployment and actual audio validation.

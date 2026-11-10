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

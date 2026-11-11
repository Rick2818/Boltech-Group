# Leo private connection verification

The `Leo private connection checks` workflow calls the existing authenticated
production API from GitHub Actions. It does not depend on the user's browser.
It runs once when its files change on main, or manually through Run workflow.
There is no schedule or extra autonomous executor.

The repository secret `LEO_PLATFORM_TOKEN` must contain the same existing owner
token used by the corporate Cloudflare Pages project. The Cloudflare deployment
token is not interchangeable. Never put this value in source, workflow inputs,
reports, command arguments or chat. If the secret is absent, report all providers
as NOT_CHECKED / DIAGNOSTIC_TOKEN_MISSING and make no network requests. Do not
rotate the Pages token merely to run this check: rotation would invalidate
existing owner sessions and the Upwork token vault.

Only main-branch runs receive the owner secret. Pull requests execute isolated
tests without secrets. Requests use the exact corporate HTTPS API, a Bearer
header and fixed `check` operations, with redirects disabled, no retries and a
bounded response. Check Upwork, Freelancer and Explee independently; a failure
does not prevent the remaining checks. Reports contain only allowlisted status
fields, HTTP status, timestamps and sanitized error codes. Do not emit provider
response bodies, account identity, tokens or customer data.

The run fails if any connection cannot be verified. The job summary distinguishes
CONNECTED, FAILED and NOT_CHECKED. A connected account does not certify search,
autonomous work, proposals, sales or 24/7 operation. No searches, messages,
applications, campaigns, credits or payments are requested by this workflow.

Verification: isolated Python tests cover missing credentials, per-provider
failure isolation, strict success responses, credential redaction, fixed
destination/read-only body, redirects and bounded responses, and safe report
generation. Real production results must be read from a main-branch run, not
from the test fixtures.

# Leo: Upwork client registration correction — 2026-11-11

## Problem and evidence

After successful account login, Upwork displayed `Client not found or disabled`.
Leo had used its `/api/upwork/client-metadata` URL as `client_id` without a
successful Upwork registration. Login to Upwork or to the ChatGPT connector does
not establish a Leo connection.

Upwork's live OAuth discovery document at
`https://mcp.upwork.com/.well-known/oauth-authorization-server` returned HTTP 200
on 2026-11-11 and advertises `https://www.upwork.com/register` as its registration
endpoint, the existing authorization/token endpoints and S256 PKCE.
A registration request from the repair environment for the exact corporate
Cloudflare callback returned HTTP 403 with an Upwork HTML error page. This does
not establish whether a request from Cloudflare will be accepted. The current
official documentation at `https://www.upwork.com/ai/mcp` warns that callbacks for
custom hosted agents are restricted. Do not substitute localhost or a different
application's callback to evade that restriction.

## Decision and implementation

An authenticated owner click now attempts RFC 7591 registration using the actual
Cloudflare callback. Only a valid HTTP 201 registration can create the stored
public client identifier and enable an authorization link. Reuse that identifier
for subsequent starts, code exchange and refresh, and bind the browser state to
it. Do not save registration management tokens or secrets. Preserve owner
sessions, encrypted OAuth tokens, PKCE and the read-only adapter.

Registration rejection returns an explicit error and no authorization URL or
OAuth cookie. The UI explains that signing in again cannot fix a rejected
registration. No alternate provider, callback, paid service, proposals, messages
or Connects are introduced. Retire the old metadata endpoint with HTTP 410.

## Acceptance and remaining dependency

Isolated regression tests cover registration, cached reuse, provider denial,
outage, malformed responses, access controls, PKCE exchange, refresh and changed
client identity. These fixtures are not live connection evidence.

Only successful provider registration, owner consent, token persistence and a
real read-only Upwork response can establish that Leo is connected. A deployment
or green test suite alone cannot do so. If registration remains denied, provider
acceptance of this hosted application remains unresolved.

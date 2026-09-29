# Boltech Group

**Autonomous Agents for Business**  
**Automate. Respond. Scale.**

Production: https://boltech-group.vercel.app

Boltech Group builds autonomous and custom AI agents for business bottlenecks such as quotations, customer questions, support, lead qualification, repetitive follow-up and workflow automation.

---

## Current production status — 2026-09-28

| Area | Status | Notes |
|---|---|---|
| Main Vercel application | Production | `boltech-group.vercel.app` |
| MCP gateway | Production | Authenticated read-only MCP endpoint at `/api/mcp` |
| A2A referral exchange | Production core | Agent Card + authenticated referral intake + PII masking |
| A2A partner identity binding | Production | Bearer credentials are SHA-256 bound to the Airtable partner record |
| A2A QA end-to-end test | Passed | Referral and Partner Activity were created successfully in Airtable |
| Provider candidate matching | In rollout | Validated providers remain PROSPECT until real approval/access is received |
| Telegram cloud agent | Secure relink deployed | Token/secret are environment-managed; final webhook registration/health test remains |
| Airtable partner CRM | Active | Partners, Referrals, Partner Activities, Commission Ledger, Payment Orders and Payment Events |
| Payment hardening | Active | Provider-confirmed payment state, server-side amount derivation and HMAC safeguards |

---

## Architecture

```text
Customer / Partner / Operator
          |
          +--> Boltech Web App
          |
          +--> MCP Gateway
          |
          +--> A2A Referral Exchange
          |       |
          |       +--> Airtable Partner Network
          |
          +--> Telegram Cloud Agent
                  |
                  +--> Vercel Serverless
```

The production design is cloud-first. Core serverless endpoints do not require Ricardo's laptop to remain powered on.

---

## MCP

Boltech exposes a remote MCP gateway through the existing Vercel API router:

```text
POST /api/mcp
Authorization: Bearer <BOLTECH_MCP_API_KEY>
```

Current read-only tools:

- `boltech_status`
- `get_bitcoin_market_data`
- `research_b2b_lead`

Authentication behavior:

- Missing server configuration: `503 MCP_AUTH_NOT_CONFIGURED`
- Missing or invalid bearer credential: `401 MCP_UNAUTHORIZED`
- Credentials are stored as environment secrets and are not committed to Git.

---

## A2A Referral Exchange

Agent Card:

```text
/.well-known/agent-card.json
```

A2A endpoint:

```text
POST /api/a2a
```

Implemented controls:

- JSON-RPC A2A message intake.
- Partner-specific Bearer authentication.
- SHA-256 lookup against the partner's `A2A Key Hash` in Airtable.
- Authenticated partner identity is resolved server-side.
- Incoming requests cannot impersonate another partner using a supplied record ID.
- Customer PII is masked when `clientConsent = false`.
- Referrals are written to Airtable.
- A corresponding `REFERRAL_RECEIVED` activity is written to Partner Activities.
- Matching considers capabilities, market and language.
- Unapproved providers can be surfaced as candidates without being granted A2A peer access.

Controlled QA validation created a real referral in Airtable with `WAITING_CONSENT` and masked PII.

### Partner onboarding states

Boltech currently tracks Apollo, Hunter, Lusha, Reply.io, Instantly, Atom and lemlist as provider/partner candidates.

They must remain `PROSPECT` and `A2A Enabled = false` until there is real evidence of approval/enrollment and, where required, technical credentials.

The intended lifecycle is:

```text
PROSPECT
   -> application/enrollment
   -> provider approval
   -> technical credentials/API access
   -> configuration
   -> A2A validation
   -> ACTIVE
```

---

## Telegram Cloud Agent

The Telegram agent runs through Vercel at:

```text
/api/telegram
```

Health endpoint:

```text
GET /api/telegram
```

Deep health mode:

```text
GET /api/telegram?deep=1
```

Security controls include:

- `TELEGRAM_BOT_TOKEN` stored in environment variables.
- `TELEGRAM_WEBHOOK_SECRET` required for webhook POSTs.
- Timing-safe secret verification.
- No hard-coded production webhook secret fallback.
- Deduplication of repeated Telegram updates.
- Authorized-user filtering.
- Cloud operation independent of the local laptop.

A secure webhook registration path is available after deployment and uses the server-side Bot Token without exposing it in client-side code.

---

## Commercial control tower — 09:00 El Salvador

GitHub Actions includes a daily MIT commercial control workflow:

```text
.github/workflows/mit_commercial_9am.yml
```

Schedule:

```text
09:00 America/El_Salvador
15:00 UTC
```

It runs a read-only commercial control script:

```text
scripts/commercial/mit_daily_control_tower.mjs
```

The daily control tower checks:

1. Boltech/Telegram production health.
2. Explee availability and visible hot-lead count when the GitHub secret is configured.
3. Apollo saved-contact availability when the GitHub secret is configured.
4. Telegram delivery of the daily MIT summary when Telegram secrets are configured.

It does **not** automatically spend Apollo credits or send prospect emails. Commercial outreach remains governed by validated targeting and real provider access.

### Daily MIT priorities

- **MIT 1:** Review and answer hot leads.
- **MIT 2:** Select 20–30 high-fit Apollo prospects instead of consuming credits indiscriminately.
- **MIT 3:** Record outcomes, measure replies and improve campaign messaging.

Responsibilities:

- **Ricardo:** payments, commercial decisions, meetings and approvals.
- **Boltech:** monitoring, qualification, routing and operational automation.
- **Explee:** outbound campaign execution after account reactivation.
- **Apollo:** prospect sourcing and enrichment.
- **Airtable:** system of record for the partner/referral network.

---

## Payment security

Production payment logic follows these controls:

- Amounts are derived from the server-side catalog rather than trusted from the browser.
- Payment confirmation requires provider verification.
- HMAC validation is used where applicable.
- Legacy public payment-confirmation routes are retired.
- Production code does not use synthetic `PAID` or `APPROVED` fallbacks.
- Commission entries follow the cash-collected policy and require real payment evidence.

Secrets and payment credentials must only be stored in provider secret stores such as Vercel or GitHub Actions Secrets.

---

## Airtable data model

Current operational tables include:

- Leads
- Partners
- Referrals
- Partner Activities
- Commission Ledger
- Payment Orders
- Payment Events

The Partner table stores operational state, capabilities, markets, languages, referral mode, A2A enablement and the A2A key hash.

---

## Development and validation

Install dependencies:

```bash
npm install
```

Run the repository test suite:

```bash
npm test
```

Production changes should follow the repository governance workflow:

```text
branch -> tests/CI -> pull request -> merge -> Vercel production deployment -> live verification
```

Never commit API keys, Bot Tokens, webhook secrets or payment credentials to the repository.

---

## Operational principle

Boltech distinguishes clearly between:

- **configured** systems,
- **tested** systems,
- **production-active** systems, and
- **external relationships still awaiting approval**.

A provider is not marked ACTIVE merely because it offers a public affiliate or partner program. Production status requires real evidence and, for technical integrations, verified credentials and an end-to-end test.

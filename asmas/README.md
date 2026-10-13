# ASMAS — ISOLATED / NOT PRODUCTION
Five agent definitions and skills catalog, deterministic synthetic case, Redis message contract, private SQL schema draft, MCP permissions. No SDK runtimes, deployed workers or live providers installed yet.

Security defaults: no outbound, no charged payment, no production deploy. Dedicated Supabase project required before running migration. Run this schema ONLY against the dedicated ASMAS database; never against any existing application database.

Run: `node --test tests/test_asmas_core.mjs tests/test_asmas_policy.mjs`

ASMAS Airtable staging base: appwADonOZJEjwsgg. Use unique synthetic test ID SYN-E2E-001.

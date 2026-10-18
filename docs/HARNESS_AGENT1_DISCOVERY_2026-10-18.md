# Harness — Agent 1 autonomous discovery — 2026-10-18
Owner: Boltech Agent 1; overseer: Agent 4. Business outcome: exactly five unique, complete and evidence-backed buyer leads daily; never use guessed identities, synthetic contacts or duplicates.
## Architecture
One GitHub Actions executor at 15:15 UTC (09:15 America/El_Salvador) or manual dispatch; one normalization / quality gate; one sanitized JSON receipt artifact. No independent cron per provider. Runs in cloud with local laptop off. Scheduler delay is possible.
Sources: Apollo saved contacts when GitHub APOLLO_API_KEY is configured (read-only); Lusha, Upwork, n8n and public internet are explicitly BLOCKED pending provider-approved API/access and verified evidence contracts. Their adapters are **not implemented**, and no browsing/scraping is falsely claimed. Upwork requires compliant use of its approved account/API.
## Acceptance
The executor must report a source-specific state even when an integration is blocked. Apollo inventory is not lead verification: missing verified buyer role, confirmed mailbox and buyer business need rejects candidates. Gate requests replacements, but cannot source an approved replacement from blocked providers. Zero qualified leads is a possible correct result; never relabel as five.
No automatic email sending, external write, credit purchase, customer communication or Agent 2 handoff has been enabled. Workflow test success verifies control software only, NOT acquisition of five real leads or autonomous production handoff. To certify end-to-end, require real run on main, five validated source-backed records, idempotent persistence, safe Agent 2 receipt and Vercel deployed diagnostic evidence.
This artifact and code are proposed in PR; main/production certification is separate.

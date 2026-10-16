# Acceptance record — Daily lead executor (2026-10-16)

Scope: PR #108 integrates the acquisition of **research candidates** from previously saved Apollo contacts into the existing Vercel 15:00 UTC cron. This is not certification of five new qualified leads daily. Lusha, Explee and Upwork need individually verified authorized integrations. No automated mail sending, spend, or Wompi changes.

## Merge gate
The repo protects main and currently requires the exact status check `followup-safety`. A workflow named `Followup Safety` reported success on head f82aad4088a7b75853e4d3ce73240ddcb2785e37, but GitHub's merge API returned HTTP 405, `Required status check \"followup-safety\" is expected`. Do not bypass required checks. Re-run the CI after this documentation update and inspect the check context in the PR's Checks tab. If context is absent, align the existing workflow job ID to `followup-safety` after inspecting its YAML; do not create a fake success status. Integration requires branch protection success.

## Production acceptance
1. PR merged into main after required checks truly pass.
2. Vercel **production deployment READY** for merge SHA.
3. Existing cron triggers once 09:00 El Salvador; verify run via authenticated execution receipt.
4. Apollo permissions and persisted Airtable upsert/re-read verified with true data, no synthetic counted.
5. Lusha, Explee and Upwork remain blocked until documented real ingest.
6. Five daily *qualified* leads are a business target, not guaranteed by candidate intake.

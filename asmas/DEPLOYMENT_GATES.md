# ASMAS isolated deployment gates

**Current status: NOT DEPLOYED.** Source branch: feature/asmas-v4-1-core. Never merge with main or deploy on boltech-group's production Vercel project.

1. Obtain explicit selection of Supabase organization and confirm pricing before provisioning an ASMAS-only project.
2. Create *separate* Vercel project or external durable worker hosting. Never use Boltech project environment variables.
3. Apply asmas/migrations/001_core.sql only to ASMAS dedicated database. Review schema, roles, backup and provider security first.
4. Provision Redis with persistence and distinct ASMAS namespace/credentials. Wire queue-worker to real broker and repo.
5. Install and pin @openai/agents in worker project; configure API key only in secret store. Test actual agent invocations with spending caps.
6. Configure Airtable QA base appwADonOZJEjwsgg; switch from staging to production only after explicit validation.
7. Verify vendor credentials from *worker* runtime: Apollo/Lusha/Gmail/payment provider and least-privilege MCP.
8. Execute the 15 fault scenarios in actual staging; offline model tests are not equivalent.
9. Keep outbound email/payment disabled until dry runs, provider reconciliation and go-live policy are approved.
10. Open a standalone ASMAS repository before any public-facing production rollout if isolation requires a separate deployment pipeline.

Current offline unit tests demonstrate behavioral contracts only, not service availability.

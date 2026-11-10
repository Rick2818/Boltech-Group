# Cloudflare autonomy incident — 2026-11-10

Corporate account f8c7c411bffaade3f6f0af4384db42e0, Worker boltech-leo-autonomy-cron.

- Dashboard showed 74 invocations and 74 uncaught exceptions in version 8307c23c; CPU and memory limit failures were zero. Historical Workers Logs were disabled. This prevents assigning an exact exception message to each historical invocation.
- Reproduced HTTP GET exception `No fetch handler!`; original Worker only exported scheduled(). Added read-only GET/HEAD root and /health responses. Public requests cannot invoke jobs; POST is 405 and unknown GET paths are 404. The health response explicitly does not certify the engine.
- Existing authenticated scheduled handler, URL, token binding and five-minute schedule preserved. Nine focused behavior/failure checks passed locally.
- Workers Logs enabled through dashboard. Code deployed through dashboard as version ed8af0fa; public /health returned scheduler-only JSON.
- Separate production regression: current Pages deployment e912df66-b088-4718-acd5-058dc0a912f0 omits /api/leo-autonomy-worker and /api/leo-objectives from both Functions routing and invocation routes. Earlier deployment 6ba3ce20-b80a-4e5e-8c04-355a85cabd54 includes both. Current Pages has revenue-engine route absent from the older deployment, so rolling back the entire site would discard newer functionality. Neither rollback nor secret changes performed.
- This scheduler patch does not restore missing Pages handlers or certify autonomous execution. Full recovery requires restoring the missing handlers alongside current Pages functions and preserving its Wompi, COMMERCE and runtime bindings.

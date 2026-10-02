# Monitoring schedule recovery

The monitor retains its hourly minute-17 schedule and adds a second opportunity at minute 47. Scheduled execution on GitHub can be delayed or omitted; these two opportunities share the same scheduler and do not guarantee punctuality.

PR validation and production monitoring use separate concurrency groups. Freshness requires a completed successful scheduled run; queued or running work does not establish completed coverage. Latest failures remain visible. History is paginated and incomplete reads are reported explicitly.

An independent watcher can request a read-only health job retry after stale coverage, only if no health run is active and the original run matches the current main commit. A retry provides new diagnostic evidence but does not prove the original cron was punctual. Future automatic execution must be observed before claiming stable scheduling.

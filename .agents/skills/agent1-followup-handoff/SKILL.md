---
name: agent1-followup-handoff
description: Stop or route follow-ups using reconciled history. Use when Agent 1 reviews replies, bounces, opt-outs or hands a conversation to Agent 2.
---

# Seguimiento y traspaso

Require current Gmail verification and complete history. Hold on unknown history. Suppress explicit rejection and opt-out, hold bounces and automatic replies, and route a real customer reply to Agent 2. Reuse the existing durable reservation, cadence, lease and receipt checks. Never retry an uncertain send or restart an exhausted sequence without review. Preserve original thread and provider identifiers.

## Execution

Use `lib/agent1_sales_skills.js`, method `reviewFollowup` through the existing Agent 1 worker. The runtime uses deterministic rules and zero model calls. Read `docs/commercial/AGENT1_SALES_SKILLS.md` for bindings, durable state, tests and current limits. Do not treat this Markdown file as an independently deployed service.

## Source

Method reference: https://knowledge.hubspot.com/sequences/unenroll-from-sequence (reviewed 2026-10-20). Boltech policy and verified evidence govern the implementation.

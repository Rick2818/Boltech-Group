---
name: agent1-icp-targeting
description: Define company fit and bounded searches for Agent 1 prospecting. Use before acquiring or ranking Boltech leads.
---

# Cliente ideal y búsqueda

Compare the company, market, role and observed process against the existing commercial policy. Exclude suppressed contacts, QA and excluded markets. Leave missing firmographics unknown. Build the search plan with the existing executor; do not purchase enrichment or create another agent.

## Execution

Use `lib/agent1_sales_skills.js`, method `planSearch / prepare` through the existing Agent 1 worker. The runtime uses deterministic rules and zero model calls. Read `docs/commercial/AGENT1_SALES_SKILLS.md` for bindings, durable state, tests and current limits. Do not treat this Markdown file as an independently deployed service.

## Source

Method reference: https://knowledge.apollo.io/hc/en-us/articles/27155177775885-How-to-Prospect-in-Apollo (reviewed 2026-10-20). Boltech policy and verified evidence govern the implementation.

# Customer catalog and FAQ intake

Production entry: https://boltech-group.pages.dev/customer-setup

The blank form belongs to Boltech. Clients provide their own business description, catalog/services, optional USD prices and availability, FAQs with approved wording, hours, delivery/return policies and escalation contact. Unknown facts remain empty. No private keys or card fields are collected.

1. The owner signs into the existing Leo session, enters the order reference under “Boltech · Gestión del pedido” and creates a private seven-day invitation. Synthetic orders must retain the synthetic checkbox. This does not verify payment.
2. The client opens that private link, completes the form and saves. The API validates the draft and binds it to the server-issued order and mode; caller-supplied activation or payment flags are ignored.
3. The owner reviews the exact immutable revision and approves it for a supervised test. The client can preview exact FAQ questions, catalog names/SKUs and hours against their persisted data. Unknown facts are referred to the named contact. Preview uses deterministic rules, not LLM inference.
4. The client accepts the reviewed configuration version. This records knowledge acceptance only. It never claims payment verification, WhatsApp activation, AI inference or final delivery.

A public form without an invitation can prepare/download JSON but cannot write tenant records. Owner approval requires the existing authenticated owner session or server-side owner Bearer credential; a customer capability cannot approve itself or another tenant’s revision. Customer access uses only a URL-fragment capability, never a query parameter. Each invitation scopes access to its own order. Configuration contents and revisions are AES-GCM encrypted in the existing COMMERCE binding; retention is 30 days. Tokens and customer records are not logged. No new infrastructure or cron is created.

The existing Pages deployment builds exactly four public files. CI tests the handler, invitation scope, input limits, failed storage, approval/version isolation and unchanged gateway/owner behavior. Deployment verification hashes both live Leo and live onboarding HTML and requires the setup API to report storage configured.

Limits: up to 100 catalog items and 100 FAQs, overall request limit 24,000 bytes. This intake does not scrape catalogs, ingest PDFs, synchronize live inventory, provision a generative model or wire a customer's WhatsApp channel. Those are separate configuration steps with provider evidence.

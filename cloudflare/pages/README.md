# Leo on the existing Cloudflare Pages project

This independent, dependency-free Pages build imports the reviewed `Leo_Cloudflare_Upwork_Directo.zip` release. It includes Leo's direct Upwork integration, read-only platform adapters and voice. It does not start a scheduler or Agente 1.

Cloudflare Git settings:

- Repository: Rick2818/Boltech-Group
- Production branch: main
- Root directory: cloudflare/pages
- Framework: None
- Build command: npm run build
- Output directory: dist

Keep the existing Pages secrets, Workers AI binding, and COMMERCE KV binding. No Wrangler configuration is added here: the existing Pages dashboard remains responsible for those settings. The repository-root wrangler.jsonc belongs to the separate Worker and is not this project's entry point.

Run `npm test` and `npm run build` from this directory. Only the three allowlisted public files enter `dist`; source, configuration, dependencies, and tests are excluded.

The gateway preserves the existing immutable backend e912df66.boltech-group.pages.dev for requests outside its explicit Leo routes, including signed payment callbacks. Retain that deployment until its backend has been migrated and verified independently. This Git connection does not certify autonomous execution or external platform authorization.

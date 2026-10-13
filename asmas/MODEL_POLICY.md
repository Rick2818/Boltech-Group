# ASMAS model policy
**Mandatory model for A1, A2, A3, A4, A5:** Google Gemini 2.5 Flash (`gemini-2.5-flash`).

No automatic switch to other Gemini variants, OpenAI models, or generic defaults. The Google key must be separately accessible in the isolated ASMAS worker; a credential in a different application or ChatGPT does not authorize reuse.

The existing OpenAI Agents SDK factory file is experimental and **must not be deployed** for ASMAS until a Gemini-backed provider has been configured and verified. The active intended model runtime is `asmas/gemini-runtime.mjs` (Google Gemini API, server-side requests).

Google's model catalog currently notes availability restrictions for certain new projects. If the key is not entitled to Gemini 2.5 Flash, ASMAS must report BLOCKED_MODEL_ACCESS, not silently swap models. No real provider calls have yet been confirmed.

All outbound email, billing and production deployment remain disabled.

---
trigger: always_on
---

# Project Test Mode: Deploy First

This project does not support fully reliable local end-to-end validation.

Reasons may include OAuth callbacks, third-party auth providers, external API allowlists, remote-only integrations, webhooks, environment-coupled infrastructure, or production-tied dependencies.

Instructions:
- Do not assume local execution is sufficient to validate behavior end to end.
- Do not present local-only testing as proof that the feature works in the real environment.
- If a safe local partial test exists, run it, but clearly label it as partial validation only.
- Prefer small, isolated, low-risk changes that are safe to deploy quickly.
- Before push, summarize deployment risks and likely blast radius.
- After push, provide an exact post-deploy verification checklist using logs, health checks, callback success, API responses, version output, and container status.
- Prefer operational clarity over false confidence.
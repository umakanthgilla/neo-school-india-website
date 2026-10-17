# ONE AI admissions connector — staging candidate, not deployed

## Staging route candidate (2026-10-17)

`staging-router.mjs` supplies the missing server-side `/api/one-ai/drafts` route boundary through the private `ONE_AI_GATEWAY` service. It is a separate staging entrypoint, disabled unless `ENABLE_ONE_AI=true`. Other requests pass to the existing isolated staging app through `NEO_APP`. The gateway must also bind `NEO_APP` to that original app (not back to the router), and still verifies the employee session and provisioned membership on every request. This does not install a staff UI or change the production Worker.

Use `wrangler.router.example.toml` only after replacing the staging service names and exact browser origin. Keep the router private until a protected staging origin is explicitly configured. The origin must host or proxy both the CRM UI and API for same-origin browser use. Cookies and caller-supplied identity headers are not forwarded to ONE AI; only bearer identity, origin, content type and idempotency key are forwarded. Sending routes are denied.

Context normalization maps the portal's actual `Visit planned` status to `Visit / Meeting`. Missing or unknown statuses now return 409 rather than incorrectly becoming `New`. Converted/Lost retain their terminal state.

Validation: 16 Node tests pass locally, including real SQLite ownership/status queries and synthetic staging-router contract checks. Gateway services are mocked in router tests: these are not deployed end-to-end tests. Cloudflare credentials, isolated D1 IDs, real service bindings, staff provisioning, model quality, review UI integration and remote acceptance remain pending.

Rollback: disable `ENABLE_ONE_AI` in the staging router to close all AI routes; legacy requests continue through `NEO_APP`. Reverting the separate staging router deployment restores its prior version. Do not modify or roll back the production app for this isolated candidate.

This separate Worker reads only lead status from Neo Growth CRM or school enquiries. It does not alter the existing Worker, site, portals, finance, credentials or schema. The engine stores drafts in a separate ONE AI Neo database. USHA uses another deployment, database and key set.

## Verified source contract

Reviewed `worker/neo-lead-crm-api-worker-transport-phase1.js` at source commit `d503b535e59471938e80c6fb6a92b59636a1eda0`. The archived `neo-lead-crm-api-worker-finance-sequences-v2.zip` was also inspected: it has school enquiries but no `neo_growth_lead_meta` table. Growth context is therefore disabled by default; enable it only after verifying the newer schema in a **staging clone**. Current cloud deployment identity is still unverified.

- `growth:<lead_id>` reads `leads` joined to `neo_growth_lead_meta.branch_id`; admissions only.
- `enquiry:<id>` reads only status from `neo_portal_records`, kind `enquiries`.
- Both require an active `neo_schools` entry and a server-configured tenant-to-school mapping.
- No name, phone, notes, child details or finance data is selected or returned.

## Security and setup

1. Run `node --test integrations/one-ai/worker.test.mjs` with Node 24.
2. Copy `wrangler.example.toml` to an ignored local config. Set the verified staging clone binding and explicit tenant mapping. Never map two independent customers to the same tenant. Do not put production identifiers into staging.
3. Set `CRM_TOKEN_SECRET` through Wrangler secrets. It must match the dedicated Neo engine's CRM signing key, be at least 32 random characters, and differ from login credentials and USHA keys.
4. Keep public Workers routes disabled; bind the Neo engine's `CRM` service to this Worker. Tokens have an exact issuer/audience/product, tenant, actor, lead ID and 60-second lifetime.
5. Deploy only the standalone connector to staging; it accepts GET context reads only. Verify wrong-school, franchise, deactivated school, modified token and missing lead tests against synthetic records.
6. Add the ONE AI server-side proxy to the **verified current** CRM backend using the new engine gateway and existing individual employee accounts. The gateway requires `/api/employee/me` to return `school_id` (present in current repository source, absent from the archived v2 package), and rejects mismatches or older responses. Never use a shared admin password or branch login to impersonate multiple approvers. Map staff roles in the engine's principal allowlist.
7. Use the engine's review component through that proxy. Prefix the selected CRM lead ID as shown above. AI output is draft text requiring staff review and a different manager's approval. No outbound endpoint is enabled.

## Release blockers

Cloudflare staging authorization and clone IDs, reconciliation with the current deployed Neo Worker, provisioned staff membership mappings and the verified employee endpoint, and human review of Telugu/Hindi/English model output. Consent, approved templates and messaging-provider configuration remain unverified, so sending remains disabled.

Vendored `auth.mjs` and `errors.mjs` implement protocol v1 from `ushaone/usha-one-technologies/one-ai`. Update them together with engine contract tests when the protocol changes. No dependency on live GitHub fetches at runtime.

## Identity gateway

`one-ai/integrations/gateway-worker.mjs` in the engine PR reuses the existing employee bearer session through a private `NEO_APP` service binding. It does not share Neo ADMIN_PASSWORD with the engine. Configure a server-owned mapping keyed by the verified employee `account_id`, with `tenantId`, `schoolId`, `authVersion` and `active:true`; provision the same individual ID in the dedicated engine principal table. Nonprovisioned and shared accounts are denied. HR details returned by the legacy identity endpoint are discarded and never sent to the engine/model. The current deployed endpoint's school identity must be verified before staging activation.


## Current-main source re-verification (2026-10-17)

Inspected `worker/neo-lead-crm-api-worker-transport-phase1.js` directly on `main`, rather than relying on the archived finance ZIP. The current source **does** declare `neo_growth_lead_meta` (including `lead_id`, `branch_id`) in `GROWTH_CRM_SCHEMA`, defines `neo_schools` with `active`, and defines `neo_portal_records` with `school_id`, `kind`, `id`, `data`. Its `GET /api/employee/me` handler returns `account_id`, `school_id`, and `staff_id`. These source facts make the connector's intended joins and identity mapping plausible, **but do not prove** that the current production/staging D1 schema, Worker deployment, or session verification matches source.

- Keep `ENABLE_GROWTH_CONTEXT=false` until a **staging clone** has been checked and the exact `leads` and growth meta join verified with synthetic test data.
- The separate `draft-bridge.mjs` calls the authenticated ONE AI gateway to generate **drafts only**. It is a server-side integration helper, not a deployed CRM route or browser-accessible endpoint. No live outbound send exists.
- The new `follow-up-plan.mjs` is a pure dry-run eligibility planner; closed statuses do not trigger drafts. Its tests and the draft-bridge tests are included in the connector CI workflow.
- Next gate: verify current Worker identity/session handler, gateway private service binding and allowlist; stage end-to-end with isolated D1 and test principals; then enable human-reviewed pilots only after explicit authorization.

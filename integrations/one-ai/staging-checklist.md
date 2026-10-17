# ONE AI Neo staging acceptance checklist — no production writes

This document is a deployment gate, not proof of a deployed integration.

## Source checks already automated
- `node --test integrations/one-ai/*.test.mjs` covers read-only admissions scope, dry-run eligibility, draft gateway bridge, and current-source contract.
- GitHub Actions run #20 passed on commit `fbca788824f5d31c9111198ad921079b3f456bdf`.
- Current main source defines `neo_growth_lead_meta`, `neo_schools`, `neo_portal_records` and `GET /api/employee/me`.

## Staging preconditions (all must be verified)
- [ ] Deploy separate Neo ONE AI engine, separate D1 database with correct `one_ai_instance.product`, and private CRM connector; do not point at live school D1.
- [ ] Configure `NEO_APP`, `ONE_AI`, `CRM` as private service bindings; no public context endpoint.
- [ ] Set distinct random secrets `ONE_AI_TOKEN_SECRET`, `CRM_TOKEN_SECRET`, correct issuer/audience/product, and scoped `SESSION_MEMBERSHIPS_JSON` through secure environment configuration.
- [ ] Verify deployed `/api/employee/me` validates a real individual staff bearer session and returns the correct `account_id` and `school_id`; no shared admin accounts.
- [ ] Provision the same employee ID and matching auth version/tenant in ONE AI principal allowlist; revoke a test employee and confirm immediate denial.
- [ ] Validate the actual staging D1 schema, joins and school ownership. Only then consider `ENABLE_GROWTH_CONTEXT=true`.
- [ ] Set up approved AI provider binding and evaluate Telugu, Hindi and English generated drafts using **synthetic** leads only.
- [ ] Confirm origin restrictions, CSRF/session rules for same-origin proxy, rate limits, audit logs, idempotency, replay resistance and failed-service behavior.
- [ ] Test create -> submit -> different manager approves; self-approval, wrong tenant, cross-school, disabled account and repeated request must be rejected.
- [ ] Verify `/api/drafts/:id/send` remains disabled; no WhatsApp, voice, email or financial side effects.
- [ ] Record rollback instructions and require explicit authorization before live pilot.

## Server-side integration contract
1. CRM's authenticated employee session is verified by private `NEO_APP` binding, not by browser-provided identity fields.
2. Gateway `/api/one-ai/drafts/generate` forwards only `{leadId,language}` with an idempotency key to the separate ONE AI engine.
3. Engine requests read-only status from Neo context Worker using a short-lived scoped token; checks tenant and school ownership.
4. Draft stays `draft` until staff submits it and a different manager approves; outbound remains disabled.
5. A browser should **not** directly invoke private service bindings or hold gateway signing keys.

## Known blocker
A passing repository test is **not** a staging deployment. Credentials, private bindings, D1 clones, staff provisioning and verified deployed worker are still required.

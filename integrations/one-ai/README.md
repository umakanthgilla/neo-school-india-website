# ONE AI admissions connector — staging candidate, not deployed

This separate Worker reads only lead status from Neo Growth CRM or school enquiries. It does not alter the existing Worker, site, portals, finance, credentials or schema. The engine stores drafts in a separate ONE AI Neo database. USHA uses another deployment, database and key set.

## Verified source contract

Reviewed `worker/neo-lead-crm-api-worker-transport-phase1.js` at source commit `d503b535e59471938e80c6fb6a92b59636a1eda0`. The deployed finance-sequences-v2 Worker may differ; verify these tables against a **staging clone** before enabling this connector.

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
6. Add the ONE AI server-side proxy to the **verified current** CRM backend after it provides individual authenticated staff IDs. Never use a shared admin password or branch login to impersonate multiple approvers. Map staff roles in the engine's principal allowlist.
7. Use the engine's review component through that proxy. Prefix the selected CRM lead ID as shown above. AI output is draft text requiring staff review and a different manager's approval. No outbound endpoint is enabled.

## Release blockers

Cloudflare staging authorization and clone IDs, reconciliation with the current deployed Neo Worker, individual staff identity integration, and human review of Telugu/Hindi/English model output. Consent, approved templates and messaging-provider configuration remain unverified, so sending remains disabled.

Vendored `auth.mjs` and `errors.mjs` implement protocol v1 from `ushaone/usha-one-technologies/one-ai`. Update them together with engine contract tests when the protocol changes. No dependency on live GitHub fetches at runtime.

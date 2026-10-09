# Finance & Payroll ONE — STAGING Release Operations
Status: NOT DEPLOYED, NOT READY FOR FINANCIAL PRODUCTION.
Development branch: feature/finance-payroll-one-foundation
Production main and the live Neo School India Worker must remain unchanged until release approval.

## Purpose
Provide a repeatable, private staging check before a Finance owner or accountant tests the separate login,
read-only business dashboard, cash ledger and accounting documents. Never use the production D1 database
for staging verification. Do not invent a Cloudflare binding, database ID or URL.

## Required independent staging resources
- Dedicated Cloudflare Worker staging service, and an independent D1 staging database with backups.
- Deployment/configuration must bundle local `worker/finance-one/*.mjs` imports together with
  `worker/neo-lead-crm-api-worker-transport-phase1.js`, or deploy a separately reviewed entrypoint.
- `FINANCE_ONE_ENVIRONMENT=staging` must be set.
- `FINANCE_ONE_READ_API_ENABLED=true` only on **staging** after database checks.
- Unique `FINANCE_ONE_SESSION_SECRET` must be a secure Worker secret, never in GitHub, HTML or screenshots.
- Finance owner credentials are **not** school portal/HO admin credentials. Provision only through an
  audited separately authorized operator process using `provisionFinanceIdentityInternal`.
- Configure the static `finance-one/portal.html` only for the staging API origin. Limit exposure;
  do not assume the repo file has been deployed to a website.
- Add Cloudflare per-IP/per-account rate limiting, security logs and reset/invitation operations
  before making the Finance login public.

## Apply these additive schema migrations to the empty staging D1 ONLY
1. `migrations/finance_payroll_one_foundation.sql`
2. `migrations/finance_payroll_one_cash_projection.sql`
3. `migrations/finance_payroll_one_accounting_journals.sql`
4. `migrations/finance_payroll_one_auth_accounts.sql`

Migrations are never applied to production as part of this procedure.
Do not copy confidential historical center/HO finance data into shared test fixtures.

## Staging gates and tests
- Run from repository root with Node 22:
  `node --experimental-sqlite --test worker/finance-one/*.test.mjs`
- No failed tests; review GitHub Actions CI result separately (current remote CI has not been verified).
- Run `financeOneStagingPreflight({db:env.DB,env})` from internal trusted staging diagnostic.
  Do not publish this diagnostic as a public endpoint; it inspects the actual D1 schema and flags.
- Verify both CENTER_A and CENTER_B with independent Finance credentials; HO account must not access private center data.
- Wrong password must fail, repeated failures must lock account temporarily, disabled or rotated account
  must invalidate old tokens.
- Creating a fee receipt/verified payment must not produce duplicate Daily Ledger entries.
- Approved invoice or payroll liability alone must not create a cash movement.
- Verified payout must produce one cash event and one balanced journal; repeated requests must not
  duplicate either. If journal posting fails, the recovery worker can repair it without a second cash entry.
- Reconcile opening balance + money in - money out and compare against the independently verified books.
- Verify read-only portal on desktop and mobile; no direct Ledger insert/edit/delete route is permitted.

## Current blockers to user acceptance
This branch contains staging-only backend and a static UI prototype. A public user acceptance URL
does not exist. Cloudflare staging D1 credentials, actual staging deploy, final operator account
provisioning process, bank/payment providers, statutory India payroll, source-workflow conversion,
accounting-rule review, security review and complete end-to-end validation remain outstanding.

Do not mark the project complete or request live money testing while any release gate fails.

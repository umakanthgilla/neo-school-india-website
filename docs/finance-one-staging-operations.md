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
5. `migrations/finance_payroll_one_receipt_evidence.sql`
6. `migrations/finance_payroll_one_legacy_payout_integrity.sql`

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


## Independent Finance-only staging entrypoint
- Use `worker/finance-one/staging-entry.mjs` rather than the full School Portal Worker for initial Finance-only staging tests.
- Start from `wrangler.finance-one.staging.toml.example`; replace all illustrative origins and staging-only D1 placeholders locally. Keep the feature flag **false** until private readiness checks pass.
- This staging entry rejects non-staging environments, unrelated School API paths and browser origins outside `FINANCE_ONE_PORTAL_ORIGIN`. It delegates Finance routes to the dedicated credential + membership gate.
- The HTML at `finance-one/portal.html` still requires a separately hosted secure staging origin; it is not currently published by creating the source file.
- All new entrypoint and CORS behavior has automated `worker/finance-one/staging-entry.test.mjs` coverage.
- Never use production D1 IDs or credential secrets in GitHub repository files.

## Verified legacy fee receipt mirroring (new staging milestone)
- `legacy-fee-receipt-verifier.mjs` reads the pre-existing `neo_portal_records` fee receipt and its linked `daily_accounts` entry. It rejects missing/duplicate ledger sources, mismatched receipt number/amount, incompatible cash-count vs bank proof, wrong legal owner, or an invoice without a posted receivable-accrual journal.
- `neo_fin_receipt_verifications` is an immutable finance evidence table: a trusted independent banking/cash reconciliation process must first attest the settlement reference, effective settlement timestamp, verifier, payment record and company. A legacy record marked "Recorded by school" does **not** qualify as independently verified.
- `sync-legacy-fee-receipt.mjs` is restricted to active authenticated Finance **write** membership. Verified receipt becomes one `neo_fin_cash_events` mirror and one balanced journal, without writing again to the existing school Daily Ledger. Repeated sync is idempotent; failed accounting postings can be retried without duplicating cash.
- SQL + full-migration integration tests exist in `sync-legacy-fee-receipt.test.mjs` (10 scenarios: genuine receipt, repeat, missing proof, HO isolation, missing accrual, mismatches, duplicate legacy posting, immutable evidence, and accounting recovery). This is **not** a live bank integration; no public receipt-verification endpoint or untrusted client toggle is enabled.
- Before staging enablement, verify exact ownership/effective dates and introduce an audited bank/cash evidence creation workflow. Do not backfill existing school receipts simply because they have `status: "Recorded by school"`.


## Original Fee Invoice → verified Fee Receipt → accounting (2026-10-09)
- `sync-legacy-fee-invoice.mjs` reads the original school invoice, student and fee structure under an independently resolved owner mapping. It does not recreate the old invoice or produce any cash movement. Its source document key includes both school and invoice ID so different schools under one legal business cannot collide.
- The original invoice creates/recovers one approved Finance document (`source_kind='legacy_invoice'`) and its balanced accrual journal: Accounts Receivable Dr / Fee Revenue Cr. Retry and changed-source amount are checked for financial conflicts.
- `legacy-fee-receipt-verifier.mjs` resolves the **same school's** original invoice, requires its posted accrual, exact school ledger link, immutable independent bank/cash evidence and correct ownership-effective date.
- `sync-legacy-fee-receipt.mjs` then produces exactly one verified cash event and a corresponding Bank/Clearing Dr / Accounts Receivable Cr journal. It does NOT insert an additional `neo_portal_records` Daily Ledger entry.
- Real full-migration tests exercise this entire path (including no duplicate legacy postings, HO denial, invalid fee structure, mismatched amounts, missing settlement evidence and no pre-payment cash).
- GitHub Actions Draft PR #26 CI completed with **152/152 tests passing, 0 failed** in run 37888295778.
- Still required: real source/verification evidence ingestion, accounting-policy signoff, production historical data migration strategy, full payroll/vouchers integration, authentic Cloudflare staging deployment, QA and security review. **Do not interpret this as a live banking integration or full application completion.**

## Legacy Payroll / Vendor Payment / Salary Advance verification
- `sync-legacy-payout-document.mjs` validates the original payroll/vendor/advance source plus its source-specific voucher and unique linked legacy Daily Ledger entry; it creates exactly one independent Finance `payment` document, but **not** cash. Retry is idempotent. Legacy `Paid` and `Released` alone do not prove settlement.
- `neo_fin_payment_settlements` must be independently and securely verified against actual bank evidence; the client cannot set a `verified` boolean and use it as payment proof.
- `legacy-payout-verifier.mjs` requires same legal business ownership, matching source document, voucher, amount, unique legacy ledger, one *full* verified settlement, and bank reference before authorizing a cash mirror.
- `sync-legacy-payout.mjs` then posts exactly one Finance cash event and balanced journal without touching school Daily Ledger; retry is idempotent.
- `finance_payroll_one_legacy_payout_integrity.sql` prevents partial or duplicate verified settlements for these **legacy single-payment** records and freezes their verified evidence. Actual bank reversals/chargebacks need new compensating journal and cash reversal workflow before production.
- Original invoice/payroll/vendor accrual accounting source linkage and detailed statutory salary deductions are **not** automatically resolved by this payout bridge. The generic A/P and salary-payable debit mappings must be reconciled with accountant-approved liabilities, not treated as proof of a fully working financial closing workflow.
- Tested against real staging schema migrations in automated SQLite tests. No live bank provider, production Worker or public finance write endpoints are connected.

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
7. `migrations/finance_payroll_one_statutory_review.sql`
8. `migrations/finance_payroll_one_statutory_remittance.sql`

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


## Deduction-aware legacy payroll accounting — 2026-10-09
- The live payroll data model contains `gross_paise`, `late_deduction_paise`, `attendance_deduction_paise`, `advance_recovery_paise`, `deductions_paise` and `net_paise`. Existing approved calculation must remain locked.
- `legacy-payroll-accrual.mjs` accepts only approved/paid, attendance-complete payroll owned by the current independent business, and rejects numeric mismatch or missing source approvals. Its staging accrual debits earned salary expense (after attendance/late deductions) and credits the full earned salary payable. It **does not clear employee advances or create Cash Money Out** at approval.
- The generic `accrual-journal.mjs` cannot process `source_kind='legacy_payroll'` to avoid incorrectly recognizing gross salary payable without deductions.
- `legacy-payout-verifier.mjs` now requires the matching balanced payroll accrual with exact earned salary payable and a locked snapshot of the payroll deduction breakdown before bank payment can reduce liability.
- Full source-to-payout integration checks ensure salary payable is zero after exact verified net bank transfer, the existing Daily Ledger is not duplicated, HO isolation is enforced and retries do not repost.
- GitHub Actions run `37890030186`: **190 passing, 0 failed**.
- **Advance recovery timing correction:** `legacy-payroll-settlement-journal.mjs` recognizes the advance set-off only when the employee's net payroll bank payment is independently verified: Debit full earned Salary Payable; Credit actual Bank net and Credit Employee Advance Receivable for the remaining recovery. The generic two-line cash journal is blocked for legacy payroll; scheduled recovery uses the specialist module. This matches the HR workflow more closely, but final legal set-off/reversal policy and historical advance balances still need CA/payroll review.
- There is NO statutory deduction engine for PF, ESI, professional tax, TDS, employer contributions or state-specific compliance in this milestone. Unknown statutory fields are blocked rather than silently dropped. A registered payroll specialist must validate applicable effective-date rules.

- 2026-10-09 follow-up CI: GitHub Actions run `37890331714` completed **190/190 passing** after the advance recovery timing correction. A subsequent focused rollback/recovery regression test was added; check its newest run separately.

## Reviewed PF/ESI/PT/TDS source accounting milestone (2026-10-09)
- Added per-independent-business account codes 2111 PF payable, 2112 ESI payable, 2113 Professional Tax payable, 2114 TDS payable, 5300 Employer statutory contributions expense.
- `reviewed-statutory-payroll.mjs` validates original payroll employee PF/ESI/PT/TDS and employer PF/ESI amounts against an immutable, independent, approved policy review with the exact payroll fingerprint. No amount can be trusted solely because a browser submits it.
- `legacy-payroll-accrual.mjs` now posts earned salary expense, employee statutory withholding liabilities, net salary payable including unpaid advance setoff, and the additional employer-contribution expense/liabilities as a balanced journal. This stage creates NO cash movement and NO duplicate legacy Daily Ledger row.
- `legacy-payout-verifier.mjs` independently verifies all resulting posted liability journal totals and the same immutable original breakdown before allowing a verified net salary bank payout.
- Employee advance recovery continues to occur only on independently verified bank settlement. PF/ESI/PT/TDS remain payable until separate statutory payment remittance workflows are built and reconciled.
- **This milestone does not calculate statutory rates or perform filing**. The existing live HR payroll does not yet generate legally reviewed amounts automatically. State applicability, thresholds, wage bases, TDS declarations, effective dates, employer exemptions, monthly remittance and government filing require current payroll-rule implementation and professional signoff.
- No operator-facing endpoint exists to insert these approvals. Onboarding, dual-control reviewer authorization, audit evidence and rate changes must be secured before staging user acceptance.
- GitHub Actions run 37890954349: **199/199 tests passed** with real SQLite migration fixtures and isolation/security regression cases. Production main and published sites unchanged.

## Verified statutory payment voucher and liability clearance (2026-10-09)
- Per-organization PF/ESI/PT/TDS closing balances from posted journals are exposed read-only by `statutory-liabilities.mjs` and Finance Dashboard; **debits are not automatically labelled government remittances** without verified bank and challan evidence.
- An independently approved Finance payment voucher is stored in `neo_fin_documents` and immutably linked to an organization-scoped `neo_fin_statutory_remittances` approval (account type, period, exact amount, voucher number, reviewer). This is an internal reviewed workflow, not a public payment/write endpoint.
- `statutory-remittance-verifier.mjs` requires the same business, exact approved voucher amount, unique matching bank settlement, independent verified bank reference, and sufficient posted statutory liability.
- `sync-statutory-remittance.mjs` mirrors only independently verified bank settlement into exactly one Money Out cash event and balanced `Statutory Payable Dr / Bank Cr` journal. Idempotent retries/recovery never create a second cash entry and never write legacy `daily_accounts`.
- `finance_payroll_one_statutory_remittance.sql` forbids multiple verified bank settlements against the same remittance document, freezes approved vouchers and bank evidence, and **prevents a concurrent overpayment at journal-post time**.
- Security: HO membership does not allow access to an independently owned Center. Staging preflight now requires the remittance table and its protective SQL triggers before enabling a staging rollout.
- Government payroll remittance endpoints, official challan verification, statutory rate calculation, annual TDS filings and actual Cloudflare D1 staging deployment are NOT connected. Approval and verification must come from separately authorized finance/bank operations, never a browser-provided verification boolean.


## Release gate extension: organization-specific readiness — 2026-10-09
- Run `financeOneBusinessPreflight({db,authenticatedAccountId,organizationId})` in a trusted staging diagnostic for **each** independent legal business, not only once for the database.
- It requires authenticated per-business Finance membership, active independent Finance credentials, complete and active per-business Chart of Accounts, and no verified cash events missing a posted accounting journal. Never expose this diagnostic to unrelated businesses or as a general public endpoint.
- It is read-only: it neither posts new cash movements nor attempts to repair incomplete accounting. Resolve its blockers using separately audited finance recovery and onboarding steps, then re-run.
- These checks complement the full **eight migration** `staging-migrations.test.mjs` suite.
- Latest GitHub Actions run `37892615347`: **225/225 tests passed, zero failures** on the development branch. This is not proof that a real Cloudflare D1 staging service, live banking, tax filing, or user acceptance environment has been deployed.


## Safe two-phase staging activation — 2026-10-09
1. Deploy a separate **private staging-only** Worker and D1 binding, initially with `FINANCE_ONE_READ_API_ENABLED=false` and `FINANCE_ONE_ENVIRONMENT=staging`. The existing Neo School India production Worker must remain untouched.
2. Apply all eight SQL migrations to the independent staging D1. Never use production D1 or production financial records as unreviewed sample fixtures.
3. Run `financeOneStagingPreflight({db:env.DB, env, phase:'prepare'})` from an authorized internal diagnostic while the Finance API feature is **OFF**. Any missing security trigger, migration, or signing secret blocks activation.
4. Provision separate Finance credentials and Chart of Accounts through an audited internal operator flow. Run `financeOneBusinessPreflight` individually for HO and each participating legal business; all required active accounts and posted cash journals must pass. An inactive chart account does **not** count as configured.
5. Add per-IP/per-account login throttling, access logs and secrets management; validate the accountant-approved accounting policy and bank evidence creation workflow. Do not expose the login publicly before those protections are configured.
6. Only then deliberately enable the Finance API on isolated staging. Run `financeOneStagingPreflight({db:env.DB,env,phase:'active'})`, full GitHub CI, login/logout/token revoke, cross-business denial and verified settlement reconciliation.
7. If any gate fails, disable `FINANCE_ONE_READ_API_ENABLED`, investigate the staging-only records, and retry. Never merge this PR or deploy the new Worker to production as an automatic result of successful unit tests.

The development Worker gate now refuses Finance routes outright if `FINANCE_ONE_ENVIRONMENT` is not exactly `staging`, including when the Finance feature flag is accidentally set to true. The isolated Worker entrypoint enforces the same boundary.

**Verification:** 230/230 GitHub automated tests passed in run `37892827857` immediately after the activation safety changes. Later account-readiness counting tests must be checked against their own CI result. These checks do not constitute a deployed Cloudflare staging URL or production certification.


## Finance login race and HTTP end-to-end validation — 2026-10-09
- The dedicated Finance password verifier now performs its final successful-login mutation using an **atomic conditional SQL UPDATE**: even if concurrent failed attempts lock the account while PBKDF2 is running, that stale valid-password request cannot bypass the new lock. Late wrong-password attempts cannot extend an active lock. Expired lockouts continue to permit recovery with valid credentials.
- A direct call to `handleFinanceLogin` also requires `FINANCE_ONE_ENVIRONMENT=staging`. This defense-in-depth check complements the independently guarded Worker entrypoint and Finance route gate; production must remain locked even when a feature flag is mistakenly enabled.
- `staging-http-e2e.test.mjs` tests real Worker `fetch()` HTTP requests against an in-memory SQLite database initialized by **all eight Finance migrations**. It covers standalone Finance login, own-business documents/Daily Ledger, HO/Center isolation, browser-origin rejection, token revocation, staging flag-off and read-only ledger enforcement.
- GitHub Actions run `37893261467`: **240/240 passing, 0 failures**. This is a full Node/SQLite integration **simulation**, not a real Cloudflare D1 staging deployment.
- Still block public staging availability until independently provisioned Cloudflare staging secrets/D1, per-IP abuse throttling, audited financial source ingestion, verified real bank/challan evidence, statutory compliance review and end-user validation are complete. Do not merge this Draft PR into production.


## Same-origin staging Finance Portal and Cloudflare packaging — 2026-10-09
- The isolated staging Worker at `worker/finance-one/staging-entry.mjs` now serves the existing `finance-one/portal.html` only at `/` or `/portal.html` when `FINANCE_ONE_ENVIRONMENT=staging` AND `FINANCE_ONE_READ_API_ENABLED=true`. Other static paths return 404. School/Parent/Teacher live routes are not hosted by this Worker.
- `wrangler.finance-one.staging.toml.example` includes an `[assets]` binding `ASSETS` with `directory="./finance-one"` and **`run_worker_first=true`**. This is a security requirement: direct Cloudflare asset serving must NEVER bypass the Worker's disabled feature flag.
- The Worker reads the HTML asset internally, injects a fresh nonce into its sole inline stylesheet/script and returns a restrictive Content Security Policy, `Cache-Control: no-store`, frame protection and no-referrer. Inline `style=` attributes have been removed to support CSP. The portal's ordinary API calls use its same-origin Worker endpoint by default.
- Hosting the portal on the same Worker does **not** mean Finance accounts are provisioned, bank settlement is verified, or access throttling is configured. Do not make this portal public until Cloudflare rate limits/Access, audit logs, staging D1 and operator credentials are explicitly approved.
- The GitHub Finance tests workflow has a separate `package-staging` job: after all Node/SQLite tests it checks a synthetic, **disabled** Wrangler config and runs `wrangler deploy --dry-run` to compile Worker/portal static assets. This is a compilation check, NEVER a deployment, Cloudflare authentication, real D1 migration or live HTTPS endpoint.
- Live staging publication (only after approval): use an independently named Staging Worker and staging-only D1 database, replace the example UUID locally, set the unique signing secret through Cloudflare secret management, confirm `phase:'prepare'` readiness with feature OFF, and only then enable Finance in isolated staging and run `phase:'active'` plus per-company readiness checks.
- The real staging portal URL is not available until an authorized Cloudflare deployment is completed. Do not advertise a GitHub file link or simulated test domain as a working login.


## Verified Cloudflare package dry-run — 2026-10-09
- GitHub Actions run `37915091106` completed successfully: **248/248** Finance ONE Node/SQLite tests passed and the separate **`package-staging`** job passed.
- The packaging job uses Wrangler v4.129.1 with `deploy --dry-run`; Wrangler bundled the isolated Finance API Worker, discovered the single `finance-one/portal.html` asset and resolved the `ASSETS` binding. The bundle's reported upload size was approximately 27.98 KiB (7.48 KiB compressed).
- The job uses a **synthetic staging D1 UUID**, keeps the Finance API flag OFF, supplies no Cloudflare credentials, and explicitly does **NOT** deploy anything.
- Before actual staging publication, a separately authorized Cloudflare operator must create the staging D1 and Worker, set secrets and permitted origins through private configuration, enforce login rate limits/Access, apply all 8 migrations, provision independent Finance identities, and verify prepare/active staging + each organization's readiness. These blockers are **not** met by a successful dry-run.
- Once permitted staging deployment is complete, the same Worker can deliver the Portal at its own HTTPS `/portal.html` path; **no real staging URL exists yet**.


## Finance login native Cloudflare rate-limiting security gate — 2026-10-09
- Login now requires **both** Cloudflare Workers native Rate Limit bindings: `FINANCE_ONE_LOGIN_CLIENT_LIMIT` (20 attempts per 60s, scoped to trusted edge client IP) and `FINANCE_ONE_LOGIN_ACCOUNT_LIMIT` (8 attempts per 60s, scoped to a SHA-256 hash of the Finance account ID).
- `login-rate-limit.mjs` checks the client allowance **before JSON parsing and PBKDF2**, checks the account allowance before password verification, returns HTTP 429 with `Retry-After: 60` on excess, and returns HTTP 503 when a required binding is missing, returns malformed data or throws. Do not fall back to unprotected login.
- Do not use user-provided `X-Forwarded-For` headers for security decisions. Unknown/absent trusted client identity is grouped in a restricted fallback key.
- The staging config `wrangler.finance-one.staging.toml.example` includes **illustrative** rate-limit `namespace_id` strings. A Cloudflare operator must replace them with namespace IDs unique to the target account before an actual staging deployment.
- Full staging preflight now refuses readiness if either native login limiter is missing. The CI Wrangler build gate checks both limiter configurations exist.
- **Limitations:** Cloudflare native counters are per location and are not a substitute for Cloudflare Access, WAF, global attack protection, login security monitoring, MFA/secure reset, or an operator-approved onboarding process. IP-based quotas can also affect multiple legitimate staff on a shared network. Tune limits against real staging traffic before use.
- GitHub Actions run `37917680984`: **258/258 automated Node/SQLite tests passed**, plus successful **Cloudflare Wrangler 4.129.1 dry-run**. Wrangler explicitly recognized both rate-limit bindings and Finance Portal Assets. No production or staging deployment occurred and no real bank data was used.


## Session-safe browser and server-side logout — 2026-10-09
- The Finance Portal now clears **all private amounts, organization labels and ledger/document rows immediately** on sign-out. It discards stale, late responses from a previous Finance session or business; an old 401 response cannot log out a newly authenticated Center session. It also displays a trial-balance warning if the accounting journal snapshot is unbalanced.
- Finance Login now creates a random, per-login HMAC-signed 48-hex-character token ID (`jti`) in the dedicated Finance bearer token. The isolated Worker checks server-side revocation before authorizing **every** Finance read request; the protected POST `/api/finance-one/v1/session/logout` revokes **only that token**, without unnecessarily revoking another device/session.
- Migration **9** `migrations/finance_payroll_one_session_revocations.sql` adds the secure Finance token revocation store. It is mandatory before feature-flag activation and included in all-migration integration fixtures. If the revocation table is unavailable, the finance API **fails closed** (HTTP 503), never assumes a token is still valid.
- The Portal attempts server logout immediately after clearing local data, and visibly warns if the backend cannot confirm revocation. Do not claim that simply clearing browser memory revokes a bearer token.
- Finance login token timeout remains 15 minutes. Long-term migration/retention and per-account device/session management UI are separate audited features; revocation rows can be purged only after token expiry through a separately authorized process.
- Browser-like asynchronous integration tests cover Center switching, stale success/401 responses, immediate confidential-data clearance, unbalanced accounting warnings and wrong-organization login responses. Backend tests cover two simultaneous logins, one-device-only server revocation, and missing revocation schema.
- GitHub Actions run `37921034526` verified **266/266 Node/SQLite tests passed**, no production merge. The separate Wrangler packaging job must also complete successfully before this is considered packaging-ready.


## Verified Cash ↔ posted Bank journal reconciliation — 2026-10-09
- `cash-journal-audit.mjs` checks **every** immutable Finance cash event in the legal business against its matching `source_kind='cash_event'` journal; matching an arbitrary posted journal header is no longer sufficient. It checks status, balanced ledger totals, and **exact Bank (chart code 1000) debit or credit** according to the original Money In / Money Out event and amount. A balanced journal with an incorrect bank-side movement fails the audit.
- It also reports draft/not-posted journals, cash events with no journal, and orphaned cash-origin journal headers without cash events. Reports include exact counts and up to 50 business-only finding identifiers for review, with a `findingsTruncated` signal if there are more; **no edits** or posting APIs.
- `finance-read-api.mjs` exposes a finance-membership-only GET `/api/finance-one/v1/organizations/{org}/cash-reconciliation`. The Finance Portal displays a review warning if the result is not ready. Cross-business access and writes are forbidden.
- `financeOneBusinessPreflight` now rejects business staging readiness when the Bank/cash audit finds any issue, even if the existing missing-journal count is zero. A finance operator must reconcile verified source evidence and correct ledger workflows through approved compensation/recovery processes, **not** edit posted journals or cash events.
- **Important limit:** This audit proves internal posting consistency only, NOT that cash actually reached a bank, a bank reconciliation feed has been connected, the contra-accounts are correct for all types of transaction, a voucher was genuine, or audited financial statements can be issued. Real bank evidence, approved adjusting entries, CA review, and independent source controls remain release blockers.
- GitHub Actions run `37922159152`: **277/277 tests passed**, Wrangler packaging dry-run also passed. Both operate on the development branch, never the production site.

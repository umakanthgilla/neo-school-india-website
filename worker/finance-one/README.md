# Finance & Payroll ONE — Staging Accounting Foundation

**Status:** Functional development components, not production-deployed. No change to the live Neo School India Worker or Daily Ledger.

## Immutable business rules
1. HO and every independent Center have their own organization-scoped finance, payroll and bank records.
2. No organization or HO admin may read another organization's private financial data merely because of its franchise relationship.
3. Transactions enter only through their originating module. No manual Daily Cash Ledger entry.
4. Verified payment/receipt becomes one cash event; journal postings must not create a second cash event.
5. Invoices, vendor bills and payroll liabilities accrue in accounting without posting Cash Money In/Out.
6. Duplicate IDs with different amounts must error instead of silently overwriting. Posted journal lines are immutable.
7. Original Neo School India HR, receipt, voucher, ledger and curriculum modules remain intact.

## Added in this milestone
- `accounting-chart.mjs`: authorized per-business chart initialization, safe retry/conflict checks.
- `source-journal.mjs`: verified cash event -> balanced double-entry journal.
- `accrual-journal.mjs`: approved invoices, purchase bills, salary liabilities -> accounting journals without cash event.
- `sync-verified-payout.mjs`: approved and verified bank payout -> unique cash event -> balanced journal; safe idempotent retry.
- `finance-reports.mjs`: private business trial balance, Money In/Out, P&L.
- `journal-recovery.mjs`: find and repair unposted cash journals within one business, no cash duplication.

## Local verification
- Node v22.16 and node:sqlite fixtures: **27/27 tests passed** across six newly added suites (not all GitHub module tests).
- Workflow `.github/workflows/finance-one-tests.yml` discovers `worker/finance-one/*.test.mjs`.
- CI result on GitHub, full migration fixture compatibility, D1 deployment and real-bank settlement verification have **not** yet been established.

## Correctness and accounting-policy gates
- Current fee collection journal offsets Accounts Receivable (assumes an invoice journal has already recognized the income). This must be verified against the real invoicing workflow.
- Purchase bills currently map to a generic cost-of-goods account; expense/stock/asset and GST mapping will need configurable, CA-approved accounting policies.
- Bank/cash clearing currently uses a generic system account, not a live bank-specific account.
- The cash and journal inserts are separately idempotent, not one combined transaction; run an authenticated scheduled recovery job and reconcile before launch.
- Payroll Paid state in the existing production Worker is not a confirmed bank settlement. Do not connect real payroll payouts until transition rules are corrected.
- Complete India payroll compliance and statutory filing features, final portal UI and Cloudflare staging deployment are not represented by this milestone.

## Validation command
```bash
node --experimental-sqlite --test worker/finance-one/*.test.mjs
```

Do not merge this branch into main or apply migrations to production without full staging and security review.


## Authenticated read API — 2026-10-09
- `finance-read-api.mjs` exposes GET-only handlers for `summary`, `documents` and `daily-ledger` under `/api/finance-one/v1/organizations/{organizationId}/...`.
- `finance-session.mjs` supplies short-lived HMAC-SHA256 Finance-specific tokens. Tokens from the old school or generic HO admin portal are NOT valid Finance credentials.
- `worker-gate.mjs` stays DISABLED unless `FINANCE_ONE_READ_API_ENABLED=true`. It requires `FINANCE_ONE_SESSION_SECRET` and a valid server-issued Finance token, then checks active membership for the requested business.
- A Finance-specific login/credential verification + token issuance endpoint is still required; **never issue a Finance token merely on the strength of shared school-portal credentials**. Only use `issueFinanceOneToken` after a separately validated finance identity.
- The gate is staged as an isolated module and is NOT yet imported by the deployed Worker. It requires a verified Cloudflare bundling/deployment path and staging database migrations.
- Verified locally with Node 22: the new route, token, gate suites pass **22/22** tests. This does not confirm GitHub CI or an available staging URL.


## Finance login + portal (2026-10-09)
- `finance-password.mjs` defines dedicated salted PBKDF2-SHA256 Finance credentials (210,000 iterations), 5-failure lockout, and account-credential version checks. It is not the school portal password store.
- `finance-login.mjs` adds POST `/api/finance-one/v1/session` accepting `{accountId,password,organizationId}`; success requires both a valid separate Finance password and explicit organization membership. Finance token lifetime is 15 minutes.
- `finance-session.mjs` now carries `credentialVersion`. `worker-gate.mjs` checks the identity is active and its credential version is still current on each Finance request.
- `migrations/finance_payroll_one_auth_accounts.sql` is additive and prevents silent credential changes/suspensions without token version rotation.
- `worker/neo-lead-crm-api-worker-transport-phase1.js` imports and calls the Finance ONE gate only in THIS development branch. It is disabled unless `FINANCE_ONE_READ_API_ENABLED=true`. Main/production have not been changed.
- `finance-one/portal.html` is a responsive read-only login and summary UI. It stores the Finance token in memory only (not localStorage), and does not allow manual ledger edits. For staging, configure `window.FINANCE_ONE_API_BASE` if the API is on a different origin.
- Focused local Node 22 SQLite integration tests passed 13/13 for PBKDF2 login, cross-business membership, lockout, revocation and protected document reads. Additional GitHub tests for full Worker import, auth SQL constraints, and portal markup are committed; the complete CI result is NOT verified.
- **Not ready for public access:** user provisioning/invitation lifecycle, Cloudflare per-IP rate limiting/WAF, abuse monitoring, secure reset, MFA where required, staging D1 migrations, deployed staging API/Pages URL, user acceptance testing and Indian payroll compliance remain release blockers.
- Never create default Finance passwords, copy school passwords, or share HO financial membership with centers. Credential bootstrap should be performed via separate audited privileged workflow; no public registration or self-provisioning route exists.


## Account provisioning and staging preflight — 2026-10-09
- `provisioning.mjs` provides **internal-only**, audited-operator Finance identity creation. Passwords are salted PBKDF2 records; credential and organization membership are written in one transactional D1 batch. It does not expose HTTP registration and refuses existing accounts.
- `staging-preflight.mjs` inspects actual SQLite/D1 schema using read-only queries and refuses staging readiness if essential tables/views/immutability triggers, staging marker, Finance feature flag or session secret are missing.
- `provisioning.test.mjs` and `staging-preflight.test.mjs` add 11 local tests (11/11 passed using Node 22 and focused SQLite/mocked D1 fixtures). This is **not** evidence of full GitHub CI success or production readiness.
- Exact staging requirements, migration order, regression gates and release blockers: `docs/finance-one-staging-operations.md`.
- Operator authorization, onboarding/invitations, abuse prevention/WAF, staging Cloudflare deployment and independent accountant acceptance are still necessary. **Do not copy school credentials or issue public Finance accounts**.


## 2026-10-09 legacy payout and reconciliation UI milestone
- Original `payroll`, `vendor_payments`, `salary_advances` -> source voucher and one existing school Daily Ledger row -> `sync-legacy-payout-document.mjs` produces a unique Finance-approved **payment document only** (no cash).
- After separate verified bank settlement, `legacy-payout-verifier.mjs` checks source state, exact money amount, original voucher, unique school ledger source, ownership and verified bank reference. `sync-legacy-payout.mjs` mirrors exactly one Finance cash event and balanced journal, never another school Daily Ledger entry.
- New schema `finance_payroll_one_legacy_payout_integrity.sql` prevents a second or partial verified settlement for legacy full payouts and protects verified evidence from editing/deletion. Real reversal/chargeback compensating events still require independent design before live banking.
- New read-only `/api/finance-one/v1/organizations/{businessId}/settlements` route returns pending/partially-verified/verified/over-verified statuses, scoped to the authenticated business; dashboard `finance-one/portal.html` renders this in a mobile-friendly Payment Verification table.
- GitHub Actions run **37889431250**: **177 tests passed, 0 failed** (Node 22; mocked and SQLite staging fixtures). Draft PR #26 is **not merged**. Full staging D1 deployment, verified real-bank ingestion, accountant-approved liability reconciliation, Indian statutory payroll, and user acceptance remain required. The new settlement statuses describe internal verification records; they do not independently certify a connection to a live bank.

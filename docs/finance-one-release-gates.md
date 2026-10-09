# Finance ONE — Pre-release gate (updated 2026-10-09)

## Preserved contract
- One entry at the source; no separate manual cash ledger entries.
- Immutable read-only daily cash projection after verified source posting.
- Independent financial ownership per HO/center; no cross-center or HO access to a center's private books.
- Existing school UI, staff, vouchers, fee receipts, ledger and payroll remain unchanged unless migration/testing approved.

## Current implementation reality
Code modules exist in worker/finance-one for tenant memberships, cash event mapping, reconciliation, idempotent event writes, settlement verification.
They are NOT connected to production Worker, NOT an end-to-end finance portal, and no staging environment has been verified.
GitHub tests have been authored but passing CI or deployed D1 migrations are not established.

## Critical blockers before a usable testing link
1. Node tests must pass (organization-access, cash-projection, reconciliation, atomic-posting, settlement-source-verifier).
2. Execute both SQL migration files on disposable D1/SQLite staging; confirm foreign keys, unique indexes and immutable triggers.
3. Resolve ownership map of each school to its independent legal business without granting HO private data access.
4. Implement authenticated server-side API routes using the membership guard.
5. Implement a trusted receipt verifier and connect to existing fee receipt source (no client-provided verified flags).
6. Implement vendor/payroll/advance voucher source contracts and approved settlement states. Confirm per-employee partial/failure/reversal rules.
7. Verify no double posting, including concurrent duplicate deliveries, altered amount retries, network failures and rollback.
8. Integrate accounting documents/journals and source vouchers without duplicating existing ledger entries.
9. Ensure money in/out only on verified receipt/payment; liability/accrual separate from cash ledger.
10. Test UI with HO, Center A, Center B identities; every business can use the same full feature set with separate data.
11. Complete compliance and bank integrations with accountant-approved rules before real payment handling.
12. Performance, backup/recovery, audit, security and accountant signoff before production.

## Fixed in latest development
- A duplicate event identity with a changed amount/direction/reference now triggers a reconciliation error instead of silently returning 'not created'.

## Do not claim ready for testing
Until a real staging URL and test execution are verified, the work remains implementation-in-progress.

## 2026-10-09 validated staging foundation update
- Added `migrations/finance_payroll_one_accounting_journals.sql`: independent Chart of Accounts and double-entry journal tables (separate from read-only Daily Cash Ledger).
- Journal must originate with a source reference; a journal starts in Draft, and can become Posted only with at least two lines and exactly balanced debits/credits.
- Posted headers and lines cannot be changed/deleted; lines cannot be moved from drafts into posted journals.
- Combined staging SQL migration and accounting safety tests were reproduced locally using SQLite/Node 22: six schema tests passed. They do NOT substitute for a deployment or full production test.
- Financial reconciliation permits negative opening balances (legitimate bank overdrafts), while rejecting unsafe numeric values.
- Fixed payroll-domain versus finance-domain read permission confusion: payroll-only context cannot be used as a finance document context.
- GitHub Actions workflow now includes the SQL schema tests. Its remote pass/fail result has not been verified.
- Critical open issue: legacy production payroll Paid transition is not yet settlement-gated, and HO admin privileges currently differ from the required private independent-business model. Do not automatically migrate legacy access rules.
- This foundation does not yet implement accounting source adapters, integrated receipt verifiers, full payroll, bank reconciliation, user-facing portal, staging URL, or production deployment.


## 2026-10-09 read-only legacy integration audit
- Inspected existing production source: `payments` -> `FIN_FEE_...`, `vouchers` -> `FIN_VCH_...`, `salary_advances` -> `FIN_ADV_...`, `payroll` -> `FIN_PAY_...`, all reflected in legacy `daily_accounts`.
- Added `worker/finance-one/legacy-ledger-audit.mjs`: no writes, detects missing/duplicate/orphan/mismatched Daily Ledger entries, matching source vouchers, and warns that legacy Payroll Paid is not verified bank settlement evidence.
- Added `authorized-legacy-audit.mjs`: maps school to its owning organization, then checks authenticated finance membership before reading school-scoped records. This code is not attached to a live route.
- Local focused audit tests passed 12/12 using Node 22, with SQLite fixtures for Center A, Center B and HO denial. Existing GitHub test workflow covers new `*.test.mjs` files, but remote CI result remains unverified.
- Current snapshot is intentionally bounded; production-scale audit needs pagination / consistent snapshots and permission-aware setup. Do not run it as a global HO audit or copy private center finances.
- This audit is NOT the final automatic posting migration and is NOT a user-facing staging portal.


## 2026-10-09 current implementation milestone — automated accounting (staging only)
- Added `accounting-chart.mjs`: an authorized independent-business Chart of Accounts bootstrap, idempotent and preflighting conflicts. Same capabilities for HO and any independent center, separate records.
- Added `source-journal.mjs`: verified cash event to balanced debit/credit accounting journal; writes no duplicate Daily Cash Ledger entry and recovers from concurrent identical retries.
- Added `accrual-journal.mjs`: approved sales invoice, purchase bill, and salary-liability source documents create double-entry accrual journals WITHOUT cash movements.
- Added `sync-verified-payout.mjs`: authorized verified bank settlement -> idempotent cash event -> balanced journal, including retry repair if cash already posted but accounting was temporarily unavailable.
- Added `finance-reports.mjs`: organization-isolated trial balance, cash movement and P&L from posted journals and cash projections. No HO access to private center reports by default.
- Added automated tests for those five modules. 25/25 locally executed with Node 22 and SQLite fixtures. These tests use targeted SQLite test schemas, not deployed Cloudflare D1. Re-validate against complete migrations in real staging before any release.
- Accounting policy assumptions need professional review before production: fee receipts applied against Accounts Receivable presume that invoice revenue was already recognized; purchase bills currently use a simplified cost-of-goods mapping, and bank/cash clearing needs transaction-specific bank accounts.
- Important: separate cash posting then journal posting is recoverable/idempotent but not a single atomic transaction. Reconciliation and a scheduled recovery worker are needed before live launch.
- No production deployment, bank connection, owner portal URL or comprehensive India statutory payroll release is implied.
